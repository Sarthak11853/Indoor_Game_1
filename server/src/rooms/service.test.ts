import { describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET } from '@hv/shared';
import { IDLE_ROOM_TTL_MS, MAX_ROOM_TTL_MS, RoomService, randomRoomCode } from './service';
import { MemoryRoomStore } from './store';

function setup() {
  let now = 1_000_000;
  const store = new MemoryRoomStore();
  const service = new RoomService(store, () => now);
  return { store, service, advance: (ms: number) => (now += ms) };
}

describe('randomRoomCode', () => {
  it('is 4 letters without I or O', () => {
    for (let i = 0; i < 200; i++) {
      const code = randomRoomCode();
      expect(code).toMatch(/^[A-Z]{4}$/);
      expect([...code].every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
    }
  });
});

describe('RoomService', () => {
  it('creates a room and lets others join with a lowercase code', async () => {
    const { service } = setup();
    const { session } = await service.create('Ana');
    const joined = await service.join(` ${session.code.toLowerCase()} `, 'Ben');
    expect(joined.room.state.players.map((p) => p.name)).toEqual(['Ana', 'Ben']);
    expect(joined.session.token).not.toBe(session.token);
  });

  it('rejects unknown codes', async () => {
    const { service } = setup();
    await expect(service.join('ZZZZ', 'Ben')).rejects.toThrow(/No room/);
  });

  it('resumes the same seat with the token, and only with the token', async () => {
    const { service } = setup();
    const { session } = await service.create('Ana');
    const resumed = await service.resume(session.code, session.token);
    expect(resumed.session.playerId).toBe(session.playerId);
    await expect(service.resume(session.code, 'not-a-token')).rejects.toThrow(/gone/);
  });

  it('invalidates the token of a player who left', async () => {
    const { service } = setup();
    const host = await service.create('Ana');
    const ben = await service.join(host.session.code, 'Ben');
    await service.act(host.session.code, { type: 'leave', playerId: ben.session.playerId });
    await expect(service.resume(host.session.code, ben.session.token)).rejects.toThrow(/gone/);
  });

  it('deletes the room when the last player leaves', async () => {
    const { service, store } = setup();
    const { session } = await service.create('Ana');
    expect(await service.act(session.code, { type: 'leave', playerId: session.playerId })).toBeNull();
    expect(await store.get(session.code)).toBeUndefined();
  });

  it('never loses a player when many join at once', async () => {
    const { service } = setup();
    const { session } = await service.create('Host');
    const names = Array.from({ length: 11 }, (_, i) => `P${i}`);
    await Promise.all(names.map((n) => service.join(session.code, n)));
    const { room } = await service.resume(session.code, session.token);
    expect(room.state.players).toHaveLength(12);
  });

  it('expires idle rooms with nobody connected, and any room after the hard limit', async () => {
    const { service, store, advance } = setup();
    const empty = await service.create('Ana');
    await service.act(empty.session.code, { type: 'connection', playerId: empty.session.playerId, connected: false });
    const busy = await service.create('Ben');

    advance(IDLE_ROOM_TTL_MS + 1);
    expect(await service.sweep()).toEqual([empty.session.code]);
    expect(await store.get(busy.session.code)).toBeDefined();

    advance(MAX_ROOM_TTL_MS);
    expect(await service.sweep()).toEqual([busy.session.code]);
  });
});
