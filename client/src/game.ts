import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { AckResult, ClientToServerEvents, ClientView, ServerToClientEvents, Session, Settings } from '@hv/shared';
import { load, save } from './storage';

// Client-side game store: holds the latest view from the server and the
// saved session, and turns UI actions into socket events. No game rules here.

export interface GameStore {
  connected: boolean;
  /** True while we hold a saved seat but the server hasn't confirmed it yet. */
  resuming: boolean;
  session: Session | null;
  view: ClientView | null;
  notice: string | null;
}

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

let store: GameStore = {
  connected: false,
  session: load<Session>('session'),
  resuming: load<Session>('session') !== null,
  view: null,
  notice: null,
};
const listeners = new Set<() => void>();

function set(patch: Partial<GameStore>) {
  store = { ...store, ...patch };
  listeners.forEach((l) => l());
}

function setSession(session: Session | null) {
  save('session', session);
  set({ session, ...(session ? {} : { view: null, resuming: false }) });
}

socket.on('connect', () => {
  set({ connected: true });
  // Rejoin our seat after every (re)connect: refresh, lock screen, network blip.
  const session = store.session;
  if (!session) return;
  set({ resuming: true });
  socket.emit('room:resume', { code: session.code, token: session.token }, (res) => {
    if (res.ok) set({ resuming: false });
    else {
      setSession(null);
      set({ notice: res.error });
    }
  });
});
socket.on('disconnect', () => set({ connected: false }));
socket.on('view', (view) => set({ view, resuming: false }));
socket.on('kicked', () => {
  setSession(null);
  set({ notice: 'The host removed you from the room.' });
});

export function useGame(): GameStore {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => store,
  );
}

function request<T extends object>(send: (ack: (res: AckResult<T>) => void) => void): Promise<AckResult<T>> {
  if (!socket.connected) return Promise.resolve({ ok: false, error: 'Not connected to the server yet.' });
  return new Promise((resolve) => send(resolve));
}

async function enter(res: AckResult<{ session: Session }>) {
  if (res.ok) {
    setSession(res.session);
    set({ notice: null });
  }
  return res;
}

export const actions = {
  create: (name: string) => request<{ session: Session }>((ack) => socket.emit('room:create', { name }, ack)).then(enter),
  join: (code: string, name: string) =>
    request<{ session: Session }>((ack) => socket.emit('room:join', { code, name }, ack)).then(enter),
  leave: async () => {
    const res = await request((ack) => socket.emit('room:leave', ack));
    setSession(null);
    return res;
  },
  reorder: (order: string[]) => request((ack) => socket.emit('lobby:reorder', { order }, ack)),
  updateSettings: (settings: Partial<Settings>) => request((ack) => socket.emit('lobby:settings', settings, ack)),
  kick: (playerId: string) => request((ack) => socket.emit('lobby:kick', { playerId }, ack)),
  dismissNotice: () => set({ notice: null }),
};
