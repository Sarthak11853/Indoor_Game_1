import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, SETTING_LIMITS } from '@hv/shared';
import { apply, newGame } from './machine';
import { RuleError, type GameState } from './types';
import { viewFor } from './view';

function lobbyWith(...names: string[]): GameState {
  let state = newGame('ABCD', 'p0', names[0] ?? 'Host');
  names.slice(1).forEach((name, i) => {
    state = apply(state, { type: 'join', playerId: `p${i + 1}`, name });
  });
  return state;
}

const ids = (s: GameState) => s.players.map((p) => p.id);

describe('lobby', () => {
  it('makes the creator the host in the first seat', () => {
    const s = newGame('ABCD', 'p0', '  Ana  ');
    expect(s.hostId).toBe('p0');
    expect(s.players).toEqual([{ id: 'p0', name: 'Ana', connected: true }]);
    expect(s.phase).toBe('lobby');
  });

  it('seats new players in join order', () => {
    expect(ids(lobbyWith('Ana', 'Ben', 'Cy'))).toEqual(['p0', 'p1', 'p2']);
  });

  it('rejects empty, too long and duplicate names', () => {
    const s = lobbyWith('Ana');
    expect(() => apply(s, { type: 'join', playerId: 'x', name: '   ' })).toThrow(RuleError);
    expect(() => apply(s, { type: 'join', playerId: 'x', name: 'x'.repeat(17) })).toThrow(RuleError);
    expect(() => apply(s, { type: 'join', playerId: 'x', name: 'ana' })).toThrow(/taken/);
  });

  it('caps the room at the maximum player count', () => {
    const s = lobbyWith(...Array.from({ length: MAX_PLAYERS }, (_, i) => `P${i}`));
    expect(() => apply(s, { type: 'join', playerId: 'x', name: 'Late' })).toThrow(/full/);
  });

  it('refuses joins once the game has started', () => {
    const s: GameState = { ...lobbyWith('Ana'), phase: 'night' };
    expect(() => apply(s, { type: 'join', playerId: 'x', name: 'Ben' })).toThrow(/started/);
  });

  it('passes the host role to the next seat when the host leaves', () => {
    const s = apply(lobbyWith('Ana', 'Ben', 'Cy'), { type: 'leave', playerId: 'p0' });
    expect(s.hostId).toBe('p1');
    expect(ids(s)).toEqual(['p1', 'p2']);
  });

  it('lets only the host kick, and not themselves', () => {
    const s = lobbyWith('Ana', 'Ben', 'Cy');
    expect(() => apply(s, { type: 'kick', by: 'p1', playerId: 'p2' })).toThrow(/host/);
    expect(() => apply(s, { type: 'kick', by: 'p0', playerId: 'p0' })).toThrow(RuleError);
    expect(ids(apply(s, { type: 'kick', by: 'p0', playerId: 'p2' }))).toEqual(['p0', 'p1']);
  });

  it('lets the host set the seating order', () => {
    const s = lobbyWith('Ana', 'Ben', 'Cy');
    expect(ids(apply(s, { type: 'reorder', by: 'p0', order: ['p2', 'p0', 'p1'] }))).toEqual(['p2', 'p0', 'p1']);
    expect(() => apply(s, { type: 'reorder', by: 'p1', order: ['p2', 'p0', 'p1'] })).toThrow(/host/);
  });

  it('rejects a seating order that is not a permutation of the players', () => {
    const s = lobbyWith('Ana', 'Ben', 'Cy');
    for (const order of [['p0', 'p1'], ['p0', 'p1', 'p1'], ['p0', 'p1', 'zz'], ['p0', 'p1', 'p2', 'p3']]) {
      expect(() => apply(s, { type: 'reorder', by: 'p0', order })).toThrow(/Seating/);
    }
  });

  it('clamps numeric settings to their limits and ignores unknown keys', () => {
    const s = apply(lobbyWith('Ana'), {
      type: 'settings',
      by: 'p0',
      settings: { midnightSeconds: 1, nightSeconds: 9999, allowTapButton: false, evil: 1 } as never,
    });
    expect(s.settings.midnightSeconds).toBe(SETTING_LIMITS.midnightSeconds[0]);
    expect(s.settings.nightSeconds).toBe(SETTING_LIMITS.nightSeconds[1]);
    expect(s.settings.allowTapButton).toBe(false);
    expect(s.settings).not.toHaveProperty('evil');
    expect(() => apply(s, { type: 'settings', by: 'p0', settings: { daySeconds: 'x' as never } })).toThrow();
  });

  it('tracks connection status without changing seats', () => {
    const s = apply(lobbyWith('Ana', 'Ben'), { type: 'connection', playerId: 'p1', connected: false });
    expect(s.players[1]).toMatchObject({ id: 'p1', connected: false });
    expect(ids(s)).toEqual(['p0', 'p1']);
  });

  it('never mutates the previous state', () => {
    const s = lobbyWith('Ana', 'Ben');
    const snapshot = structuredClone(s);
    apply(s, { type: 'leave', playerId: 'p1' });
    apply(s, { type: 'reorder', by: 'p0', order: ['p1', 'p0'] });
    expect(s).toEqual(snapshot);
  });
});

describe('viewFor', () => {
  it('returns public state plus only the viewer’s own id', () => {
    const v = viewFor(lobbyWith('Ana', 'Ben'), 'p1');
    expect(v.me).toEqual({ playerId: 'p1' });
    expect(v.public.players.map((p) => p.name)).toEqual(['Ana', 'Ben']);
  });
});
