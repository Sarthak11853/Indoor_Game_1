import type { AlarmKind, InboxItem } from '@hv/shared';
import { living, shuffle } from '../game/rules';
import type { Alarm, Context, GameState, Player } from '../game/types';
import { ALARM_TIMING, ALARM_WEIGHTS, DANGER, MISSIONS, VILLAGE, WHISPERS } from './alarms.config';

// The surprise alarm engine. Pure functions over GameState, like the rules:
// the state machine calls them on ticks, and they never touch timers or sockets.

/** Fills {placeholders} in config text. */
export const fill = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));

const pickOne = <T>(items: readonly T[], rng: () => number): T => items[Math.floor(rng() * items.length)];

/** Milliseconds until the next alarm: ~2 min early on, shrinking to 40–60s near midnight. */
export function alarmGap(state: GameState, ctx: Context, firstOfDay: boolean): number {
  const total = state.settings.midnightSeconds * 1000;
  const left = (state.midnightAt ?? ctx.now + total) - ctx.now;
  const progress = Math.min(1, Math.max(0, 1 - left / total));
  const base = ALARM_TIMING.earlySeconds + (ALARM_TIMING.lateSeconds - ALARM_TIMING.earlySeconds) * progress;
  const [min, max] = ALARM_TIMING.firstOfDay;
  const factor = firstOfDay ? min + (max - min) * ctx.rng() : 1 + ALARM_TIMING.jitter * (2 * ctx.rng() - 1);
  return Math.round(base * factor * 1000);
}

export function addInbox(state: GameState, playerId: string, source: InboxItem['source'], text: string): GameState {
  const item: InboxItem = { id: `m${state.seq}`, round: state.round, source, text };
  return {
    ...state,
    seq: state.seq + 1,
    inbox: { ...state.inbox, [playerId]: [...(state.inbox[playerId] ?? []), item] },
  };
}

/** Fire one alarm now and schedule the next. `force` picks the kind (dev panel only). */
export function fireAlarm(state: GameState, ctx: Context, force?: AlarmKind): GameState {
  const next = { ...state, nextAlarmAt: ctx.now + alarmGap(state, ctx, false) };
  const secondsLeft = force ? Infinity : ((state.phaseEndsAt ?? ctx.now) - ctx.now) / 1000 - ALARM_TIMING.marginSeconds;
  const busy = new Set(state.alarms.map((a) => a.targetId));
  // Connected living players without a running alarm can receive one.
  const free = living(state).filter((p) => p.connected && !busy.has(p.id));

  // A spirit's haunt takes priority: it becomes a danger alarm on that player.
  const haunted = free.find((p) => next.haunts.includes(p.id));
  if (!force && haunted && DANGER.seconds <= secondsLeft) {
    return danger({ ...next, haunts: next.haunts.filter((id) => id !== haunted.id) }, haunted, ctx);
  }

  const missions = MISSIONS.filter((m) => m.seconds <= secondsLeft);
  const village = villageOptions(next, secondsLeft);
  let kind: AlarmKind | null = force ?? null;
  if (!kind) {
    const options: [keyof typeof ALARM_WEIGHTS, number][] = [
      ['danger', free.length && DANGER.seconds <= secondsLeft ? ALARM_WEIGHTS.danger : 0],
      ['mission', free.length && missions.length ? ALARM_WEIGHTS.mission : 0],
      ['whisper', free.length && WHISPERS.seconds <= secondsLeft ? ALARM_WEIGHTS.whisper : 0],
      ['village', village.length ? ALARM_WEIGHTS.village : 0],
    ];
    const group = weighted(options, ctx.rng);
    kind = group === 'village' ? pickOne(village, ctx.rng) : group;
  }
  if (!kind) return next;
  if (kind === 'blackout' || kind === 'swapSeats' || kind === 'relicRace') {
    // Only one village-wide alarm at a time, even when forced.
    const allowed = force ? !state.alarms.some((a) => a.targetId === null) : village.includes(kind);
    return allowed ? villageAlarm(next, kind, ctx) : next;
  }
  if (!free.length) return next;

  const target = fairTarget(next, free, ctx.rng);
  if (kind === 'danger') return danger(next, target, ctx);
  if (kind === 'mission') {
    const mission = pickOne(missions.length ? missions : MISSIONS, ctx.rng);
    const text = target.role === 'possessed' ? mission.possessed : mission.villager;
    return start(next, { kind: 'mission', targetId: target.id, text, endsAt: ctx.now + mission.seconds * 1000 });
  }
  const clue = makeClue(next, target, ctx.rng);
  const withClue = addInbox(next, target.id, 'clue', clue);
  return start(withClue, { kind: 'whisper', targetId: target.id, text: clue, endsAt: ctx.now + WHISPERS.seconds * 1000 });
}

/** Remove alarms whose time is up, applying the penalty for a missed danger alarm. */
export function expireAlarms(state: GameState, now: number): GameState {
  let next = state;
  for (const alarm of state.alarms) {
    if (alarm.endsAt > now) continue;
    next = { ...next, alarms: next.alarms.filter((a) => a.id !== alarm.id) };
    if (alarm.kind === 'danger' && alarm.targetId) {
      next = { ...next, voteBonus: { ...next.voteBonus, [alarm.targetId]: (next.voteBonus[alarm.targetId] ?? 0) - 1 } };
      next = addInbox(next, alarm.targetId, 'alarm', DANGER.missed);
    }
  }
  return next;
}

function danger(state: GameState, target: Player, ctx: Context): GameState {
  return start(state, {
    kind: 'danger',
    targetId: target.id,
    text: pickOne(DANGER.texts, ctx.rng),
    endsAt: ctx.now + DANGER.seconds * 1000,
  });
}

type VillageKind = keyof typeof VILLAGE;

function villageOptions(state: GameState, secondsLeft: number): VillageKind[] {
  if (state.alarms.some((a) => a.targetId === null)) return [];
  return (Object.keys(VILLAGE) as VillageKind[]).filter(
    (kind) =>
      VILLAGE[kind].seconds <= secondsLeft && (kind !== 'relicRace' || state.relicRaces < VILLAGE.relicRace.maxPerMatch),
  );
}

function villageAlarm(state: GameState, kind: VillageKind, ctx: Context): GameState {
  const { seconds, text } = VILLAGE[kind];
  let next = state;
  if (kind === 'swapSeats') next = { ...next, players: shuffle(next.players, ctx.rng) };
  if (kind === 'relicRace') next = { ...next, relicRaces: next.relicRaces + 1 };
  return start(next, { kind, targetId: null, text, endsAt: ctx.now + seconds * 1000 });
}

function start(state: GameState, alarm: Omit<Alarm, 'id'>): GameState {
  const counts = alarm.targetId
    ? { ...state.alarmCounts, [alarm.targetId]: (state.alarmCounts[alarm.targetId] ?? 0) + 1 }
    : state.alarmCounts;
  return { ...state, seq: state.seq + 1, alarmCounts: counts, alarms: [...state.alarms, { id: `a${state.seq}`, ...alarm }] };
}

/** Whoever has had the fewest personal alarms so far; ties broken at random. */
function fairTarget(state: GameState, players: Player[], rng: () => number): Player {
  const fewest = Math.min(...players.map((p) => state.alarmCounts[p.id] ?? 0));
  return pickOne(
    players.filter((p) => (state.alarmCounts[p.id] ?? 0) === fewest),
    rng,
  );
}

/** A true, partial clue about who is Possessed, from the receiver's point of view. */
export function makeClue(state: GameState, me: Player, rng: () => number): string {
  const circle = living(state);
  const others = circle.filter((p) => p.id !== me.id);
  const evil = others.filter((p) => p.role === 'possessed');
  const good = others.filter((p) => p.role === 'villager');
  const clues: (() => string)[] = [];

  if (circle.length >= 3) {
    clues.push(() => {
      const i = circle.findIndex((p) => p.id === me.id);
      const left = circle[(i - 1 + circle.length) % circle.length];
      const right = circle[(i + 1) % circle.length];
      const template = [left, right].some((p) => p.role === 'possessed') ? WHISPERS.neighboursSome : WHISPERS.neighboursNone;
      return fill(template, { a: left.name, b: right.name });
    });
  }
  if (evil.length && others.length >= 2) {
    clues.push(() => {
      const culprit = pickOne(evil, rng);
      const decoy = pickOne(
        others.filter((p) => p.id !== culprit.id),
        rng,
      );
      const [a, b] = rng() < 0.5 ? [culprit, decoy] : [decoy, culprit];
      return fill(WHISPERS.pair, { a: a.name, b: b.name });
    });
    clues.push(() => {
      const i = circle.findIndex((p) => p.id === me.id);
      const distances = evil.map((p) => {
        const d = Math.abs(circle.indexOf(p) - i);
        return Math.min(d, circle.length - d);
      });
      return fill(WHISPERS.distance, { n: Math.min(...distances) });
    });
  }
  if (good.length) clues.push(() => fill(WHISPERS.innocent, { a: pickOne(good, rng).name }));

  return clues.length ? pickOne(clues, rng)() : fill(WHISPERS.innocent, { a: me.name });
}

function weighted<T>(options: [T, number][], rng: () => number): T | null {
  const total = options.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const [value, w] of options) {
    if ((roll -= w) < 0) return value;
  }
  return null;
}
