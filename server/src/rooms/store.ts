import type { GameState } from '../game/types';

export interface Room {
  state: GameState;
  /** Secret reconnection token -> player id. Never sent to other players. */
  tokens: Record<string, string>;
  lastActive: number;
}

/**
 * Where rooms live. Async so a Redis-backed version can drop in later
 * without changing callers.
 */
export interface RoomStore {
  get(code: string): Promise<Room | undefined>;
  save(room: Room): Promise<void>;
  delete(code: string): Promise<void>;
  codes(): Promise<string[]>;
}

export class MemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();

  async get(code: string) {
    return this.rooms.get(code);
  }
  async save(room: Room) {
    this.rooms.set(room.state.code, room);
  }
  async delete(code: string) {
    this.rooms.delete(code);
  }
  async codes() {
    return [...this.rooms.keys()];
  }
}
