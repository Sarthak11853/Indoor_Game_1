import type { Server, Socket } from 'socket.io';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from '@hv/shared';
import { RuleError, type Action } from '../game/types';
import { viewFor } from '../game/view';
import type { Room } from '../rooms/store';
import type { RoomService } from '../rooms/service';

interface SocketData {
  code?: string;
  playerId?: string;
}

export type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type HVSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerSocketHandlers(io: IO, rooms: RoomService) {
  // "CODE:playerId" -> ids of that player's open sockets (a player may have two tabs).
  const presence = new Map<string, Set<string>>();
  // One pending phase/midnight timer per room.
  const timers = new Map<string, NodeJS.Timeout>();

  /** Send every phone in the room its own view. */
  async function broadcast(room: Room) {
    const now = rooms.now();
    for (const s of await io.in(room.state.code).fetchSockets()) {
      if (s.data.playerId && room.state.players.some((p) => p.id === s.data.playerId)) {
        s.emit('view', viewFor(room.state, s.data.playerId, now));
      }
    }
  }

  /** Wake the room up when its phase ends or the midnight clock strikes. */
  function schedule(code: string, room: Room | null) {
    clearTimeout(timers.get(code));
    timers.delete(code);
    if (!room || room.state.phase === 'gameOver') return;
    const due = [room.state.phaseEndsAt, room.state.midnightAt].filter((t): t is number => t !== null);
    if (due.length === 0) return;
    const delay = Math.max(0, Math.min(...due) - rooms.now()) + 20;
    timers.set(
      code,
      setTimeout(() => act(code, { type: 'tick' }).catch(() => {}), delay),
    );
  }

  async function act(code: string, action: Action) {
    const room = await rooms.act(code, action);
    schedule(code, room);
    if (room) await broadcast(room);
    return room;
  }

  /** Update a player's connected flag from how many sockets they have open. */
  async function syncPresence(code: string, playerId: string) {
    const connected = (presence.get(`${code}:${playerId}`)?.size ?? 0) > 0;
    try {
      await act(code, { type: 'connection', playerId, connected });
    } catch {
      // The room or player is already gone; nothing to update.
    }
  }

  async function attach(socket: HVSocket, room: Room, playerId: string) {
    await detach(socket);
    const { code } = room.state;
    socket.data = { code, playerId };
    await socket.join(code);
    const key = `${code}:${playerId}`;
    presence.set(key, (presence.get(key) ?? new Set()).add(socket.id));
    await syncPresence(code, playerId);
  }

  async function detach(socket: HVSocket) {
    const { code, playerId } = socket.data;
    if (!code || !playerId) return;
    socket.data = {};
    await socket.leave(code);
    const key = `${code}:${playerId}`;
    const sockets = presence.get(key);
    sockets?.delete(socket.id);
    if (sockets?.size === 0) presence.delete(key);
    await syncPresence(code, playerId);
  }

  io.on('connection', (socket) => {
    const seat = () => {
      const { code, playerId } = socket.data;
      if (!code || !playerId) throw new RuleError('You are not in a room.');
      return { code, playerId };
    };

    socket.on('room:create', (p, ack) =>
      respond(ack, async () => {
        const { room, session } = await rooms.create(p?.name);
        await attach(socket, room, session.playerId);
        return { session };
      }),
    );

    socket.on('room:join', (p, ack) =>
      respond(ack, async () => {
        const { room, session } = await rooms.join(p?.code, p?.name);
        await attach(socket, room, session.playerId);
        return { session };
      }),
    );

    socket.on('room:resume', (p, ack) =>
      respond(ack, async () => {
        const { room, session } = await rooms.resume(p?.code, p?.token);
        await attach(socket, room, session.playerId);
        return { session };
      }),
    );

    socket.on('room:leave', (ack) =>
      respond(ack, async () => {
        const { code, playerId } = seat();
        await act(code, { type: 'leave', playerId });
        await detach(socket);
        return {};
      }),
    );

    socket.on('lobby:reorder', (p, ack) =>
      respond(ack, async () => {
        const { code, playerId } = seat();
        if (!Array.isArray(p?.order)) throw new RuleError('Invalid seating order.');
        await act(code, { type: 'reorder', by: playerId, order: p.order.map(String) });
        return {};
      }),
    );

    socket.on('lobby:settings', (p, ack) =>
      respond(ack, async () => {
        const { code, playerId } = seat();
        if (typeof p !== 'object' || p === null) throw new RuleError('Invalid settings.');
        await act(code, { type: 'settings', by: playerId, settings: p });
        return {};
      }),
    );

    socket.on('lobby:kick', (p, ack) =>
      respond(ack, async () => {
        const { code, playerId } = seat();
        const target = String(p?.playerId);
        await act(code, { type: 'kick', by: playerId, playerId: target });
        for (const s of await io.in(code).fetchSockets()) {
          if (s.data.playerId !== target) continue;
          s.emit('kicked');
          const live = io.sockets.sockets.get(s.id);
          if (live) await detach(live);
        }
        return {};
      }),
    );

    /** Handler for an action that only needs to know who sent it. */
    const simple = (build: (playerId: string) => Action) => (ack: Ack) =>
      respond(ack, async () => {
        const { code, playerId } = seat();
        await act(code, build(playerId));
        return {};
      });

    socket.on('game:start', simple((by) => ({ type: 'start', by })));
    socket.on('game:ready', simple((playerId) => ({ type: 'ready', playerId })));
    socket.on('game:charm', simple((playerId) => ({ type: 'charm', playerId, source: 'button' })));
    socket.on('game:skipDay', simple((by) => ({ type: 'skipDay', by })));
    socket.on('game:playAgain', simple((by) => ({ type: 'playAgain', by })));
    socket.on('game:pick', (p, ack) =>
      simple((playerId) => ({ type: 'pick', playerId, targetId: String(p?.targetId) }))(ack),
    );

    socket.on('disconnect', () => {
      void detach(socket);
    });
  });
}

/** Run a handler and report its result or a player-safe error through the ack. */
async function respond<T extends object>(ack: Ack<T> | unknown, fn: () => Promise<T>) {
  const reply: Ack<T> = typeof ack === 'function' ? (ack as Ack<T>) : () => {};
  try {
    reply({ ok: true, ...(await fn()) });
  } catch (err) {
    if (!(err instanceof RuleError)) console.error(err);
    reply({ ok: false, error: err instanceof RuleError ? err.message : 'Something went wrong.' });
  }
}
