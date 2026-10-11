import { randomBytes, randomInt } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type Session } from '@hv/shared';
import { apply, newGame } from '../game/machine';
import { RuleError, type Action, type Context } from '../game/types';
import type { Room, RoomStore } from './store';

/** A room nobody is connected to is removed after this long without activity. */
export const IDLE_ROOM_TTL_MS = 30 * 60 * 1000;
/** Any room is removed after this long without activity, even with phones still connected. */
export const MAX_ROOM_TTL_MS = 4 * 60 * 60 * 1000;

const randomId = (bytes: number) => randomBytes(bytes).toString('base64url');

export function randomRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

export function normalizeCode(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toUpperCase() : '';
}

/**
 * Rooms, tokens and expiry on top of the pure game machine.
 * Updates to the same room run one at a time, so concurrent joins
 * can never overwrite each other.
 */
export class RoomService {
  private queues = new Map<string, Promise<unknown>>();

  constructor(
    private store: RoomStore,
    readonly now: () => number = Date.now,
    private rng: () => number = Math.random,
  ) {}

  private ctx(): Context {
    return { now: this.now(), rng: this.rng };
  }

  async create(name: string): Promise<{ room: Room; session: Session }> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const code = randomRoomCode();
      const created = await this.serial(code, async () => {
        if (await this.store.get(code)) return null;
        const playerId = randomId(6);
        const room: Room = { state: newGame(code, playerId, name), tokens: {}, lastActive: this.now() };
        return this.saveWithToken(room, playerId);
      });
      if (created) return created;
    }
    throw new Error('Could not find a free room code.');
  }

  async join(rawCode: unknown, name: string): Promise<{ room: Room; session: Session }> {
    const code = normalizeCode(rawCode);
    return this.serial(code, async () => {
      const room = await this.require(code);
      const playerId = randomId(6);
      room.state = apply(room.state, { type: 'join', playerId, name }, this.ctx());
      return this.saveWithToken(room, playerId);
    });
  }

  /** Rejoin the same seat after a refresh, lock screen or network drop. */
  async resume(rawCode: unknown, token: unknown): Promise<{ room: Room; session: Session }> {
    const code = normalizeCode(rawCode);
    return this.serial(code, async () => {
      const room = await this.require(code);
      const playerId = typeof token === 'string' ? room.tokens[token] : undefined;
      if (!playerId) throw new RuleError('Your seat in this room is gone.');
      room.lastActive = this.now();
      await this.store.save(room);
      return { room, session: { code, token: token as string, playerId } };
    });
  }

  /** Apply a game action. Returns null if the room was emptied and deleted. */
  async act(code: string, action: Action): Promise<Room | null> {
    return this.serial(code, async () => {
      const room = await this.require(code);
      room.state = apply(room.state, action, this.ctx());
      room.lastActive = this.now();
      // Forget tokens of players who are no longer seated (left or kicked).
      const seated = new Set(room.state.players.map((p) => p.id));
      for (const [token, playerId] of Object.entries(room.tokens)) {
        if (!seated.has(playerId)) delete room.tokens[token];
      }
      if (seated.size === 0) {
        await this.store.delete(code);
        return null;
      }
      await this.store.save(room);
      return room;
    });
  }

  /** Delete inactive rooms. Returns the deleted codes. */
  async sweep(): Promise<string[]> {
    const deleted: string[] = [];
    for (const code of await this.store.codes()) {
      await this.serial(code, async () => {
        const room = await this.store.get(code);
        if (!room) return;
        const idle = this.now() - room.lastActive;
        const anyoneHere = room.state.players.some((p) => p.connected);
        if (idle > MAX_ROOM_TTL_MS || (idle > IDLE_ROOM_TTL_MS && !anyoneHere)) {
          await this.store.delete(code);
          deleted.push(code);
        }
      });
    }
    return deleted;
  }

  private async saveWithToken(room: Room, playerId: string) {
    const token = randomId(18);
    room.tokens[token] = playerId;
    room.lastActive = this.now();
    await this.store.save(room);
    return { room, session: { code: room.state.code, token, playerId } };
  }

  private async require(code: string): Promise<Room> {
    const room = code ? await this.store.get(code) : undefined;
    if (!room) throw new RuleError('No room with that code.');
    return room;
  }

  /** Run fn after every earlier update to the same room has finished. */
  private serial<T>(code: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(code) ?? Promise.resolve();
    const next = previous.then(fn, fn);
    const settled = next.catch(() => {});
    this.queues.set(code, settled);
    settled.then(() => {
      if (this.queues.get(code) === settled) this.queues.delete(code);
    });
    return next;
  }
}
