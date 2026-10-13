import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, PHASE_SECONDS } from '@hv/shared';
import { harness, seeded } from '../game/testkit';
import { viewFor } from '../game/view';
import type { GameState } from '../game/types';
import { DANGER, MISSIONS, VILLAGE, WHISPERS } from './alarms.config';
import { alarmGap, makeClue } from './engine';

const ctxAt = (now: number, seed = 1) => ({ now, rng: seeded(seed) });

describe('alarm timing', () => {
  const state = (midnightAt: number) =>
    ({ settings: { ...DEFAULT_SETTINGS, midnightSeconds: 600 }, midnightAt }) as GameState;

  it('is about 2 minutes apart early in the match', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gap = alarmGap(state(600_000), ctxAt(0, seed), false);
      expect(gap).toBeGreaterThanOrEqual(96_000);
      expect(gap).toBeLessThanOrEqual(144_000);
    }
  });

  it('speeds up to 40–60 seconds as midnight nears', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gap = alarmGap(state(600_000), ctxAt(600_000, seed), false);
      expect(gap).toBeGreaterThanOrEqual(40_000);
      expect(gap).toBeLessThanOrEqual(60_000);
    }
  });

  it('schedules the first alarm of each day early in the day', () => {
    const h = harness(5);
    h.toDay(['p4']);
    const delay = h.state.nextAlarmAt! - h.now();
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThan(DEFAULT_SETTINGS.daySeconds * 1000);
  });

  it('fires during the day only, and only alarms that can finish before dusk', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const h = harness(6, seed);
      h.toDay(['p5']);
      while (h.state.phase === 'day') {
        h.wake();
        for (const alarm of h.state.alarms) {
          if (h.state.phase === 'day') expect(alarm.endsAt).toBeLessThanOrEqual(h.state.phaseEndsAt!);
        }
      }
      expect(h.state.phase).toBe('vote');
      expect(h.state.alarms).toEqual([]);
      expect(h.state.nextAlarmAt).toBeNull();
    }
  });
});

describe('fairness', () => {
  it('spreads personal alarms evenly across connected players', () => {
    const h = harness(8, 7);
    h.act({ type: 'settings', by: 'p0', settings: { midnightSeconds: 1800, daySeconds: 300 } });
    h.act({ type: 'connection', playerId: 'p7', connected: false });
    h.toDay(['p6', 'p7']);
    let fired = 0;
    while (fired < 40) {
      // Keep the day and the midnight clock from ever running out.
      h.state = { ...h.state, phaseEndsAt: h.now() + 300_000, midnightAt: h.now() + 1_800_000 };
      const before = h.state.seq;
      h.wake();
      if (h.state.seq > before) fired++;
    }
    const counts = h.state.alarmCounts;
    expect(counts.p7 ?? 0).toBe(0); // disconnected players are skipped
    const connected = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id) => counts[id] ?? 0);
    expect(Math.max(...connected) - Math.min(...connected)).toBeLessThanOrEqual(1);
  });
});

describe('danger', () => {
  it('is cleared by tapping your charm in time', () => {
    const h = harness(5);
    h.toDay(['p4']);
    h.addAlarm({ kind: 'danger', targetId: 'p1', text: DANGER.texts[0], endsAt: h.now() + 5000 });
    h.act({ type: 'charm', playerId: 'p1', source: 'button' });
    expect(h.state.alarms).toEqual([]);
    expect(viewFor(h.state, 'p1', 0).me).toMatchObject({ voteWeight: 1 });
    expect(h.state.inbox.p1.at(-1)?.text).toBe(DANGER.saved);
  });

  it('costs your vote this round when missed', () => {
    const h = harness(5);
    h.toDay(['p4']);
    h.addAlarm({ kind: 'danger', targetId: 'p1', text: DANGER.texts[0], endsAt: h.now() + 5000 });
    h.wait(5);
    expect(h.state.inbox.p1.at(-1)?.text).toBe(DANGER.missed);
    h.act({ type: 'skipDay', by: 'p0' });
    expect(viewFor(h.state, 'p1', 0).me.voteWeight).toBe(0);
    expect(() => h.act({ type: 'pick', playerId: 'p1', targetId: 'p2' })).toThrow(/lost your vote/);

    // The vote still ends early once everyone who can vote has.
    for (const id of ['p0', 'p2', 'p3', 'p4']) h.act({ type: 'pick', playerId: id, targetId: id === 'p2' ? 'p3' : 'p2' });
    expect(h.state.phase).toBe('result');

    // The penalty lasts only this round.
    h.wait(PHASE_SECONDS.result);
    expect(viewFor(h.state, 'p1', 0).me.voteWeight).toBe(1);
  });

  it('ignores a charm tap when there is nothing to answer', () => {
    const h = harness(5);
    h.toDay(['p4']);
    expect(() => h.act({ type: 'charm', playerId: 'p1', source: 'button' })).toThrow(/quiet/);
  });
});

describe('missions', () => {
  it('gives each side its own mission text, and an extra vote on success', () => {
    const h = harness(5);
    h.toDay(['p4']);
    let seed = 0;
    // Fire alarms until both a Villager and the Possessed got a mission.
    const seen = new Map<string, string>();
    while (seen.size < 2 && seed++ < 500) {
      const h2 = harness(5, seed);
      h2.toDay(['p4']);
      h2.wake();
      const mission = h2.state.alarms.find((a) => a.kind === 'mission');
      if (!mission) continue;
      const role = h2.state.players.find((p) => p.id === mission.targetId)!.role!;
      seen.set(role, mission.text);
      const pair = MISSIONS.find((m) => m.villager === mission.text || m.possessed === mission.text)!;
      expect(mission.text).toBe(role === 'possessed' ? pair.possessed : pair.villager);
    }
    expect(seen.size).toBe(2);

    const alarm = h.addAlarm({ kind: 'mission', targetId: 'p2', text: MISSIONS[0].villager, endsAt: h.now() + 60_000 });
    h.act({ type: 'missionDone', playerId: 'p2', alarmId: alarm.id });
    expect(() => h.act({ type: 'missionDone', playerId: 'p2', alarmId: alarm.id })).toThrow(/over/);
    h.act({ type: 'skipDay', by: 'p0' });
    expect(viewFor(h.state, 'p2', 0).me.voteWeight).toBe(2);
    h.act({ type: 'pick', playerId: 'p2', targetId: 'p3' });
    h.act({ type: 'pick', playerId: 'p0', targetId: 'p1' });
    h.wait(PHASE_SECONDS.vote);
    expect(h.state.lastVote).toEqual({ eliminatedId: 'p3', tally: { p3: 2, p1: 1 } });
  });

  it('is only visible to the player who received it', () => {
    const h = harness(5);
    h.toDay(['p4']);
    h.addAlarm({ kind: 'mission', targetId: 'p4', text: MISSIONS[0].possessed, endsAt: h.now() + 60_000 });
    expect(viewFor(h.state, 'p4', 0).me.alarms).toHaveLength(1);
    for (const id of ['p0', 'p1', 'p2', 'p3']) {
      expect(JSON.stringify(viewFor(h.state, id, 0))).not.toContain(MISSIONS[0].possessed);
    }
  });
});

describe('whisper clues', () => {
  // Turn each clue template into a regex so we can check every generated clue is true.
  const pattern = (template: string) =>
    new RegExp(`^${template.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, '(?<$1>.+?)')}$`);

  it('are always true', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = seeded(seed);
      const h = harness(4 + (seed % 9), seed);
      h.act({ type: 'start', by: 'p0' });
      // Kill a few players at random so clues must skip the dead.
      h.state = { ...h.state, players: h.state.players.map((p) => (rng() < 0.2 ? { ...p, alive: false } : p)) };
      const alive = h.state.players.filter((p) => p.alive);
      if (alive.length < 2) continue;
      const me = alive[Math.floor(rng() * alive.length)];
      const clue = makeClue(h.state, me, rng);
      const byName = new Map(h.state.players.map((p) => [p.name, p]));
      const evil = (name: string) => byName.get(name)!.role === 'possessed';
      const circle = alive;
      const i = circle.indexOf(me);

      let m: RegExpMatchArray | null;
      if ((m = clue.match(pattern(WHISPERS.neighboursSome)))) {
        expect(evil(m.groups!.a) || evil(m.groups!.b)).toBe(true);
      } else if ((m = clue.match(pattern(WHISPERS.neighboursNone)))) {
        expect(evil(m.groups!.a) || evil(m.groups!.b)).toBe(false);
      } else if ((m = clue.match(pattern(WHISPERS.pair)))) {
        expect(evil(m.groups!.a) || evil(m.groups!.b)).toBe(true);
        expect([m.groups!.a, m.groups!.b]).not.toContain(me.name);
      } else if ((m = clue.match(pattern(WHISPERS.innocent)))) {
        expect(evil(m.groups!.a)).toBe(false);
      } else if ((m = clue.match(pattern(WHISPERS.distance)))) {
        const distances = circle
          .filter((p) => p.role === 'possessed' && p !== me)
          .map((p) => Math.min(Math.abs(circle.indexOf(p) - i), circle.length - Math.abs(circle.indexOf(p) - i)));
        expect(Number(m.groups!.n)).toBe(Math.min(...distances));
      } else {
        throw new Error(`Unrecognised clue: ${clue}`);
      }
    }
  });

  it('use the seating order, skipping the dead', () => {
    const h = harness(6);
    h.toDay(['p3']);
    h.state = {
      ...h.state,
      players: h.state.players.map((p) => (p.id === 'p1' ? { ...p, alive: false } : p)),
    };
    // Living circle: p0 p2 p3 p4 p5. p2's neighbours are p0 and p3 (Possessed).
    const rng = () => 0; // first clue type: neighbours
    expect(makeClue(h.state, h.state.players[2], rng)).toBe(
      WHISPERS.neighboursSome.replace('{a}', 'P0').replace('{b}', 'P3'),
    );
  });
});

describe('village-wide alarms', () => {
  it('appear on every phone, one at a time', () => {
    const h = harness(5);
    h.toDay(['p4']);
    h.addAlarm({ kind: 'blackout', targetId: null, text: VILLAGE.blackout.text, endsAt: h.now() + 20_000 });
    for (const id of ['p0', 'p1', 'p4']) expect(viewFor(h.state, id, 0).public.alarm?.kind).toBe('blackout');
    for (let i = 0; i < 30; i++) {
      h.state = { ...h.state, nextAlarmAt: h.now(), phaseEndsAt: h.now() + 300_000 };
      h.act({ type: 'tick' });
      expect(h.state.alarms.filter((a) => a.targetId === null).length).toBeLessThanOrEqual(1);
    }
  });

  it('swap seats reshuffles the seating order', () => {
    let swapped = false;
    for (let seed = 1; seed < 400 && !swapped; seed++) {
      const h = harness(8, seed);
      h.toDay(['p6', 'p7']);
      const before = h.state.players.map((p) => p.id);
      h.wake();
      if (h.state.alarms.some((a) => a.kind === 'swapSeats')) {
        swapped = true;
        expect([...h.state.players.map((p) => p.id)].sort()).toEqual([...before].sort());
      }
    }
    expect(swapped).toBe(true);
  });
});

describe('relic race', () => {
  function race() {
    const h = harness(5);
    h.toDay(['p4']);
    h.addAlarm({ kind: 'relicRace', targetId: null, text: VILLAGE.relicRace.text, endsAt: h.now() + 30_000 });
    return h;
  }

  it('is won by the first tap, and each relic card works once per match', () => {
    const h = race();
    h.act({ type: 'relic', playerId: 'p2', cardId: 'card-A' });
    expect(viewFor(h.state, 'p0', 0).public.alarm?.winnerId).toBe('p2');
    expect(() => h.act({ type: 'relic', playerId: 'p3', cardId: 'card-B' })).toThrow(/No relic race/);
    h.addAlarm({ kind: 'relicRace', targetId: null, text: VILLAGE.relicRace.text, endsAt: h.now() + 30_000 });
    expect(() => h.act({ type: 'relic', playerId: 'p3', cardId: 'card-A' })).toThrow(/spent/);
  });

  it('rewards an extra vote or a private peek at one role', () => {
    const h = race();
    h.act({ type: 'relic', playerId: 'p2', cardId: null });
    expect(viewFor(h.state, 'p2', 0).me.relicReward).toBe(true);
    h.act({ type: 'relicReward', playerId: 'p2', reward: { choice: 'peek', targetId: 'p4' } });
    expect(h.state.inbox.p2.at(-1)?.text).toContain('P4 is Possessed');
    expect(() => h.act({ type: 'relicReward', playerId: 'p2', reward: { choice: 'vote' } })).toThrow(/no relic reward/);

    const v = race();
    v.act({ type: 'relic', playerId: 'p1', cardId: null });
    v.act({ type: 'relicReward', playerId: 'p1', reward: { choice: 'vote' } });
    expect(viewFor(v.state, 'p1', 0).me.voteWeight).toBe(2);
  });

  it('never runs more often than the per-match limit', () => {
    const h = harness(5, 3);
    h.act({ type: 'settings', by: 'p0', settings: { midnightSeconds: 1800, daySeconds: 300 } });
    h.toDay(['p4']);
    for (let i = 0; i < 300; i++) {
      h.state = { ...h.state, phaseEndsAt: h.now() + 300_000, midnightAt: h.now() + 1_800_000, alarms: [] };
      h.state = { ...h.state, nextAlarmAt: h.now() };
      h.act({ type: 'tick' });
    }
    expect(h.state.relicRaces).toBe(VILLAGE.relicRace.maxPerMatch);
  });
});

describe('spirits', () => {
  /** p1 is taken on night 1; we land on night 2 with p1 as a Spirit. */
  function withSpirit() {
    const h = harness(6);
    h.toNight(['p5']);
    h.night('p5', 'p1');
    h.wait(DEFAULT_SETTINGS.nightSeconds);
    h.wait(PHASE_SECONDS.morning);
    h.act({ type: 'skipDay', by: 'p0' });
    h.wait(PHASE_SECONDS.vote);
    h.wait(PHASE_SECONDS.result);
    expect(h.state.phase).toBe('night');
    return h;
  }

  it('can send one hint per night, delivered privately at morning', () => {
    const h = withSpirit();
    expect(() => h.act({ type: 'spiritHint', playerId: 'p0', targetId: 'p2', text: 'hi' })).toThrow(/Only Spirits/);
    h.act({ type: 'spiritHint', playerId: 'p1', targetId: 'p2', text: '  watch   P5  ' });
    expect(() => h.act({ type: 'spiritHaunt', playerId: 'p1', targetId: 'p3' })).toThrow(/already used/);
    expect(h.state.inbox.p2 ?? []).toEqual([]); // not yet
    h.wait(DEFAULT_SETTINGS.nightSeconds);
    expect(h.state.inbox.p2.at(-1)).toMatchObject({ source: 'spirit', text: 'A spirit whispers: "watch P5"' });
    expect(h.state.inbox.p3 ?? []).toEqual([]);
  });

  it('caps hint length and rejects empty hints', () => {
    const h = withSpirit();
    expect(() => h.act({ type: 'spiritHint', playerId: 'p1', targetId: 'p2', text: '   ' })).toThrow(/Write a hint/);
    h.act({ type: 'spiritHint', playerId: 'p1', targetId: 'p2', text: 'x'.repeat(500) });
    expect(h.state.pendingHints[0].text).toHaveLength(80);
  });

  it('can haunt a living player, who gets the first alarm next day: a danger alarm', () => {
    const h = withSpirit();
    h.act({ type: 'spiritHaunt', playerId: 'p1', targetId: 'p3' });
    h.wait(DEFAULT_SETTINGS.nightSeconds);
    h.wait(PHASE_SECONDS.morning);
    h.wake();
    expect(h.state.alarms[0]).toMatchObject({ kind: 'danger', targetId: 'p3' });
    expect(h.state.haunts).toEqual([]);
  });

  it('can only act at night, and only on the living', () => {
    const h = withSpirit();
    expect(() => h.act({ type: 'spiritHaunt', playerId: 'p1', targetId: 'p1' })).toThrow(/living/);
    h.wait(DEFAULT_SETTINGS.nightSeconds);
    expect(() => h.act({ type: 'spiritHaunt', playerId: 'p1', targetId: 'p2' })).toThrow();
  });
});

describe('dev alarm trigger', () => {
  it('fires the requested kind now without changing the regular schedule', () => {
    const h = harness(5);
    h.toDay(['p4']);
    const scheduled = h.state.nextAlarmAt;
    for (const kind of ['danger', 'mission', 'whisper', 'blackout'] as const) {
      h.act({ type: 'devAlarm', kind });
      expect(h.state.alarms.at(-1)?.kind).toBe(kind);
    }
    expect(h.state.nextAlarmAt).toBe(scheduled);
    expect(() => h.act({ type: 'devAlarm', kind: 'nope' as never })).toThrow(/Unknown/);
  });

  it('still allows only one village-wide alarm at a time', () => {
    const h = harness(5);
    h.toDay(['p4']);
    h.act({ type: 'devAlarm', kind: 'swapSeats' });
    expect(() => h.act({ type: 'devAlarm', kind: 'relicRace' })).toThrow(/cannot fire/);
  });

  it('only works during the day', () => {
    const h = harness(5);
    h.toNight(['p4']);
    expect(() => h.act({ type: 'devAlarm', kind: 'danger' })).toThrow();
  });
});
