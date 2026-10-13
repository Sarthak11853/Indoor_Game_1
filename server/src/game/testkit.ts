// Test helpers shared by the game and alarm tests.
import { PHASE_SECONDS, type Role } from '@hv/shared';
import { apply, newGame, nextWakeAt } from './machine';
import type { Action, Alarm, GameState } from './types';

/** Small seeded PRNG so random games replay identically. */
export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tiny harness: a game plus a clock we control. */
export function harness(playerCount: number, seed = 1) {
  let now = 1_000_000;
  const rng = seeded(seed);
  let state = newGame('ABCD', 'p0', 'P0');
  for (let i = 1; i < playerCount; i++) state = apply(state, { type: 'join', playerId: `p${i}`, name: `P${i}` }, { now, rng });
  const h = {
    get state() {
      return state;
    },
    set state(s: GameState) {
      state = s;
    },
    act: (a: Action) => (state = apply(state, a, { now, rng })),
    /** Move the clock forward and let the timer fire. */
    wait: (seconds: number) => {
      now += seconds * 1000;
      return h.act({ type: 'tick' });
    },
    now: () => now,
    /** Force specific roles (everyone else becomes a Villager). */
    roles: (possessed: string[]) => {
      state = {
        ...state,
        players: state.players.map((p) => ({ ...p, role: (possessed.includes(p.id) ? 'possessed' : 'villager') as Role })),
      };
    },
    /** Start, set roles, and confirm everyone has seen their role. Lands on night 1. */
    toNight: (possessed: string[]) => {
      h.act({ type: 'start', by: 'p0' });
      h.roles(possessed);
      state.players.forEach((p) => h.act({ type: 'ready', playerId: p.id }));
    },
    /** Charm + pick for one player. */
    night: (playerId: string, targetId: string) => {
      h.act({ type: 'charm', playerId, source: 'button' });
      return h.act({ type: 'pick', playerId, targetId });
    },
    alive: () => state.players.filter((p) => p.alive).map((p) => p.id),
    /** Start and play through a quiet night and morning. Lands on day 1. */
    toDay: (possessed: string[]) => {
      h.toNight(possessed);
      h.wait(state.settings.nightSeconds);
      h.wait(PHASE_SECONDS.morning);
    },
    /** Jump to the next moment the server timer would wake the room. */
    wake: () => {
      const at = nextWakeAt(state);
      if (at === null) throw new Error('nothing scheduled');
      now = Math.max(now, at);
      return h.act({ type: 'tick' });
    },
    /** Put a ready-made alarm into play. */
    addAlarm: (alarm: Omit<Alarm, 'id'>) => {
      state = { ...state, alarms: [...state.alarms, { id: `t${state.alarms.length}`, ...alarm }] };
      return state.alarms[state.alarms.length - 1];
    },
  };
  return h;
}
