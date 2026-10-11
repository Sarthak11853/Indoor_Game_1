import {
  ALARM_KINDS,
  DEFAULT_SETTINGS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PHASE_SECONDS,
  SETTING_LIMITS,
  type Role,
  type Settings,
  type WinReason,
} from '@hv/shared';
import { addInbox, alarmGap, expireAlarms, fill, fireAlarm } from '../alarms/engine';
import { DANGER, MISSION_OUTCOMES, RELIC_OUTCOMES, SPIRITS } from '../alarms/alarms.config';
import { assignRoles, checkWinner, living, resolveNight, resolveVote, voteWeight } from './rules';
import { RuleError, type Action, type Context, type GameState, type Player } from './types';

// The game as a pure state machine: apply(state, action, ctx) returns the next
// state or throws a RuleError. Time and randomness come in through ctx.
//
//   lobby → reveal → night → morning → day → vote → result → night …
//                                 ↘ gameOver ↙ (win check after morning and result)
//   The midnight clock ends the match from any phase once it strikes.
//   During the day, surprise alarms fire on ticks (see alarms/engine.ts).

const freshMatch = () => ({
  round: 0,
  phaseEndsAt: null,
  midnightAt: null,
  ready: [],
  picks: {},
  lastNight: null,
  lastVote: null,
  winner: null,
  winReason: null,
  alarms: [],
  nextAlarmAt: null,
  seq: 0,
  alarmCounts: {},
  relicRaces: 0,
  usedRelics: [],
  voteBonus: {},
  relicRewards: [],
  inbox: {},
  spiritActed: [],
  pendingHints: [],
  haunts: [],
});

/** The next moment a timer must wake this room, or null if nothing is pending. */
export function nextWakeAt(state: GameState): number | null {
  if (state.phase === 'gameOver' || state.phase === 'lobby') return null;
  const times = [state.phaseEndsAt, state.midnightAt, state.nextAlarmAt, ...state.alarms.map((a) => a.endsAt)];
  const due = times.filter((t): t is number => t !== null);
  return due.length ? Math.min(...due) : null;
}

export function newGame(code: string, hostId: string, hostName: string): GameState {
  const base: GameState = {
    code,
    phase: 'lobby',
    hostId,
    players: [],
    settings: { ...DEFAULT_SETTINGS },
    ...freshMatch(),
  };
  return addPlayer(base, hostId, hostName);
}

export function apply(state: GameState, action: Action, ctx: Context): GameState {
  if (state.midnightAt !== null && state.phase !== 'gameOver' && ctx.now >= state.midnightAt) {
    return endGame(state, 'possessed', 'midnight');
  }

  switch (action.type) {
    case 'join':
      inPhase(state, 'lobby');
      return addPlayer(state, action.playerId, action.name);

    case 'leave':
      inPhase(state, 'lobby');
      return removePlayer(state, action.playerId);

    case 'kick':
      inPhase(state, 'lobby');
      hostOnly(state, action.by);
      if (action.playerId === action.by) throw new RuleError('Use Leave to leave the room.');
      return removePlayer(state, action.playerId);

    case 'reorder': {
      inPhase(state, 'lobby');
      hostOnly(state, action.by);
      const byId = new Map(state.players.map((p) => [p.id, p]));
      const order = action.order;
      if (order.length !== byId.size || new Set(order).size !== order.length || !order.every((id) => byId.has(id))) {
        throw new RuleError('Seating order must list every player exactly once.');
      }
      return { ...state, players: order.map((id) => byId.get(id)!) };
    }

    case 'settings':
      inPhase(state, 'lobby');
      hostOnly(state, action.by);
      return { ...state, settings: mergeSettings(state.settings, action.settings) };

    case 'connection':
      getPlayer(state, action.playerId);
      return updatePlayer(state, action.playerId, { connected: action.connected });

    case 'start': {
      inPhase(state, 'lobby');
      hostOnly(state, action.by);
      if (state.players.length < MIN_PLAYERS) throw new RuleError(`You need at least ${MIN_PLAYERS} players.`);
      const roles = assignRoles(
        state.players.map((p) => p.id),
        ctx.rng,
      );
      return {
        ...state,
        ...freshMatch(),
        phase: 'reveal',
        phaseEndsAt: ctx.now + PHASE_SECONDS.reveal * 1000,
        players: state.players.map((p) => ({ ...p, role: roles[p.id], alive: true })),
      };
    }

    case 'ready': {
      inPhase(state, 'reveal');
      getPlayer(state, action.playerId);
      const next = { ...state, ready: addOnce(state.ready, action.playerId) };
      return next.ready.length === next.players.length ? advance(next, ctx) : next;
    }

    case 'charm': {
      if (state.phase !== 'night' && state.phase !== 'day') throw new RuleError('Your charm is quiet right now.');
      livingPlayer(state, action.playerId);
      if (action.source === 'button' && !state.settings.allowTapButton) {
        throw new RuleError('This match is cards only: tap your physical charm.');
      }
      if (state.phase === 'night') return { ...state, ready: addOnce(state.ready, action.playerId) };
      // By day the charm answers a danger alarm.
      const alarm = state.alarms.find((a) => a.kind === 'danger' && a.targetId === action.playerId);
      if (!alarm) throw new RuleError('Your charm is quiet right now.');
      const next = { ...state, alarms: state.alarms.filter((a) => a.id !== alarm.id) };
      return addInbox(next, action.playerId, 'alarm', DANGER.saved);
    }

    case 'missionDone': {
      inPhase(state, 'day');
      const alarm = state.alarms.find(
        (a) => a.id === action.alarmId && a.kind === 'mission' && a.targetId === action.playerId && a.endsAt >= ctx.now,
      );
      if (!alarm) throw new RuleError('That mission is over.');
      const next = {
        ...state,
        alarms: state.alarms.filter((a) => a.id !== alarm.id),
        voteBonus: bump(state.voteBonus, action.playerId, 1),
      };
      return addInbox(next, action.playerId, 'alarm', MISSION_OUTCOMES.done);
    }

    case 'relic': {
      inPhase(state, 'day');
      livingPlayer(state, action.playerId);
      if (action.cardId === null && !state.settings.allowTapButton) {
        throw new RuleError('This match is cards only: tap a relic card.');
      }
      const race = state.alarms.find((a) => a.kind === 'relicRace' && !a.winnerId);
      if (!race) throw new RuleError('No relic race is running.');
      if (action.cardId && state.usedRelics.includes(action.cardId)) throw new RuleError('This relic’s power is spent.');
      const next = {
        ...state,
        // Keep the race on screen a few seconds so everyone sees who won.
        alarms: state.alarms.map((a) => (a.id === race.id ? { ...a, winnerId: action.playerId, endsAt: ctx.now + 4000 } : a)),
        usedRelics: action.cardId ? [...state.usedRelics, action.cardId] : state.usedRelics,
        relicRewards: addOnce(state.relicRewards, action.playerId),
      };
      return addInbox(next, action.playerId, 'relic', RELIC_OUTCOMES.won);
    }

    case 'relicReward': {
      if (!state.relicRewards.includes(action.playerId)) throw new RuleError('You have no relic reward to claim.');
      const next = { ...state, relicRewards: state.relicRewards.filter((id) => id !== action.playerId) };
      if (action.reward.choice === 'vote') {
        return addInbox({ ...next, voteBonus: bump(next.voteBonus, action.playerId, 1) }, action.playerId, 'relic', RELIC_OUTCOMES.vote);
      }
      const target = getPlayer(state, action.reward.targetId);
      if (target.id === action.playerId) throw new RuleError('Choose someone else.');
      const role = target.role === 'possessed' ? 'Possessed' : 'a Villager';
      return addInbox(next, action.playerId, 'relic', fill(RELIC_OUTCOMES.peek, { a: target.name, role }));
    }

    case 'spiritHint':
    case 'spiritHaunt': {
      inPhase(state, 'night');
      const me = getPlayer(state, action.playerId);
      if (me.alive) throw new RuleError('Only Spirits can do that.');
      if (state.spiritActed.includes(me.id)) throw new RuleError('You have already used your power tonight.');
      const target = state.players.find((p) => p.id === action.targetId);
      if (!target?.alive) throw new RuleError('Choose a living player.');
      const next = { ...state, spiritActed: [...state.spiritActed, me.id] };
      if (action.type === 'spiritHaunt') return { ...next, haunts: [...next.haunts, target.id] };
      const text = cleanHint(action.text);
      return { ...next, pendingHints: [...next.pendingHints, { to: target.id, text }] };
    }

    case 'pick': {
      if (state.phase !== 'night' && state.phase !== 'vote') throw new RuleError('There is nothing to pick right now.');
      const me = livingPlayer(state, action.playerId);
      const target = state.players.find((p) => p.id === action.targetId);
      if (!target?.alive) throw new RuleError('Pick a living player.');
      if (target.id === me.id) throw new RuleError('You cannot pick yourself.');
      if (state.phase === 'night') {
        if (!state.ready.includes(me.id)) throw new RuleError('Tap your charm first.');
        if (me.role === 'possessed' && target.role === 'possessed') throw new RuleError('They are one of you.');
      }
      if (state.phase === 'vote' && voteWeight(state, me.id) === 0) throw new RuleError('You lost your vote this round.');
      const next = { ...state, picks: { ...state.picks, [me.id]: target.id } };
      const waitingOn = living(next).filter((p) => !next.picks[p.id] && (next.phase === 'night' || voteWeight(next, p.id) > 0));
      return waitingOn.length === 0 ? advance(next, ctx) : next;
    }

    case 'skipDay':
      inPhase(state, 'day');
      hostOnly(state, action.by);
      return advance(state, ctx);

    case 'playAgain':
      inPhase(state, 'gameOver');
      hostOnly(state, action.by);
      return {
        ...state,
        ...freshMatch(),
        phase: 'lobby',
        players: state.players.map((p) => ({ ...p, role: null, alive: true })),
      };

    case 'devAlarm': {
      inPhase(state, 'day');
      if (!ALARM_KINDS.includes(action.kind)) throw new RuleError('Unknown alarm.');
      const fired = fireAlarm(state, ctx, action.kind);
      if (fired.alarms.length === state.alarms.length) throw new RuleError('That alarm cannot fire right now.');
      // Keep the regular schedule: a forced alarm is extra.
      return { ...fired, nextAlarmAt: state.nextAlarmAt };
    }

    case 'tick': {
      let next = expireAlarms(state, ctx.now);
      if (next.phase === 'day' && next.nextAlarmAt !== null && ctx.now >= next.nextAlarmAt) next = fireAlarm(next, ctx);
      return next.phaseEndsAt !== null && ctx.now >= next.phaseEndsAt ? advance(next, ctx) : next;
    }
  }
}

/** Move to the next phase, resolving whatever the current phase decided. */
function advance(state: GameState, ctx: Context): GameState {
  const timed = (seconds: number) => ({ phaseEndsAt: ctx.now + seconds * 1000, ready: [], picks: {} });

  switch (state.phase) {
    case 'reveal':
    case 'result': {
      const win = state.phase === 'result' && checkWinner(state);
      if (win) return endGame(state, win.winner, win.reason);
      return {
        ...state,
        ...timed(state.settings.nightSeconds),
        phase: 'night',
        round: state.round + 1,
        midnightAt: state.midnightAt ?? ctx.now + state.settings.midnightSeconds * 1000,
        voteBonus: {},
        spiritActed: [],
      };
    }

    case 'night': {
      const lastNight = resolveNight(state, ctx.rng);
      let next = lastNight.takenId ? updatePlayer(state, lastNight.takenId, { alive: false }) : state;
      // Spirit hints written tonight arrive with the dawn.
      for (const hint of next.pendingHints) next = addInbox(next, hint.to, 'spirit', fill(SPIRITS.hint, { text: hint.text }));
      return { ...next, ...timed(PHASE_SECONDS.morning), phase: 'morning', lastNight, pendingHints: [] };
    }

    case 'morning': {
      const win = checkWinner(state);
      if (win) return endGame(state, win.winner, win.reason);
      const day = { ...state, ...timed(state.settings.daySeconds), phase: 'day' as const };
      return { ...day, nextAlarmAt: ctx.now + alarmGap(day, ctx, true) };
    }

    case 'day':
      // Alarms belong to the day; any still running end without effect.
      return { ...state, ...timed(PHASE_SECONDS.vote), phase: 'vote', alarms: [], nextAlarmAt: null };

    case 'vote': {
      const lastVote = resolveVote(state);
      const next = lastVote.eliminatedId ? updatePlayer(state, lastVote.eliminatedId, { alive: false }) : state;
      return { ...next, ...timed(PHASE_SECONDS.result), phase: 'result', lastVote };
    }

    default:
      return state;
  }
}

function endGame(state: GameState, winner: Role, winReason: WinReason): GameState {
  return { ...state, phase: 'gameOver', phaseEndsAt: null, ready: [], picks: {}, alarms: [], nextAlarmAt: null, winner, winReason };
}

function addPlayer(state: GameState, playerId: string, rawName: string): GameState {
  if (state.players.length >= MAX_PLAYERS) throw new RuleError('This room is full.');
  const name = cleanName(rawName);
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new RuleError('That name is taken in this room.');
  }
  const player: Player = { id: playerId, name, connected: true, role: null, alive: true };
  return { ...state, players: [...state.players, player] };
}

function removePlayer(state: GameState, playerId: string): GameState {
  getPlayer(state, playerId);
  const players = state.players.filter((p) => p.id !== playerId);
  // The host role passes to the next seat when the host leaves.
  const hostId = state.hostId === playerId ? (players[0]?.id ?? '') : state.hostId;
  return { ...state, players, hostId };
}

function updatePlayer(state: GameState, playerId: string, patch: Partial<Player>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

function mergeSettings(current: Settings, patch: Partial<Settings>): Settings {
  const next = { ...current };
  for (const key of Object.keys(SETTING_LIMITS) as (keyof typeof SETTING_LIMITS)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    const [min, max] = SETTING_LIMITS[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new RuleError('Invalid setting.');
    next[key] = Math.min(max, Math.max(min, Math.round(value)));
  }
  if (patch.allowTapButton !== undefined) next.allowTapButton = patch.allowTapButton === true;
  return next;
}

function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (!name) throw new RuleError('Please enter a name.');
  if (name.length > MAX_NAME_LENGTH) throw new RuleError(`Names can be at most ${MAX_NAME_LENGTH} characters.`);
  return name;
}

const addOnce = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);

const bump = (counts: Record<string, number>, id: string, by: number) => ({ ...counts, [id]: (counts[id] ?? 0) + by });

function cleanHint(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (!text) throw new RuleError('Write a hint first.');
  return text.slice(0, SPIRITS.maxHintLength);
}

function getPlayer(state: GameState, playerId: string): Player {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new RuleError('That player is not in this room.');
  return player;
}

function livingPlayer(state: GameState, playerId: string): Player {
  const player = getPlayer(state, playerId);
  if (!player.alive) throw new RuleError('Spirits cannot do that.');
  return player;
}

function inPhase(state: GameState, phase: GameState['phase']) {
  if (state.phase === phase) return;
  throw new RuleError(phase === 'lobby' ? 'The game has already started.' : 'You cannot do that right now.');
}

function hostOnly(state: GameState, playerId: string) {
  if (state.hostId !== playerId) throw new RuleError('Only the host can do that.');
}
