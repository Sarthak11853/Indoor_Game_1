import {
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
import { assignRoles, checkWinner, living, resolveNight, resolveVote } from './rules';
import { RuleError, type Action, type Context, type GameState, type Player } from './types';

// The game as a pure state machine: apply(state, action, ctx) returns the next
// state or throws a RuleError. Time and randomness come in through ctx.
//
//   lobby → reveal → night → morning → day → vote → result → night …
//                                 ↘ gameOver ↙ (win check after morning and result)
//   The midnight clock ends the match from any phase once it strikes.

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
});

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
      inPhase(state, 'night');
      livingPlayer(state, action.playerId);
      if (action.source === 'button' && !state.settings.allowTapButton) {
        throw new RuleError('This match is cards only: tap your physical charm.');
      }
      return { ...state, ready: addOnce(state.ready, action.playerId) };
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
      const next = { ...state, picks: { ...state.picks, [me.id]: target.id } };
      return living(next).every((p) => next.picks[p.id]) ? advance(next, ctx) : next;
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

    case 'tick':
      return state.phaseEndsAt !== null && ctx.now >= state.phaseEndsAt ? advance(state, ctx) : state;
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
      };
    }

    case 'night': {
      const lastNight = resolveNight(state, ctx.rng);
      const next = lastNight.takenId ? updatePlayer(state, lastNight.takenId, { alive: false }) : state;
      return { ...next, ...timed(PHASE_SECONDS.morning), phase: 'morning', lastNight };
    }

    case 'morning': {
      const win = checkWinner(state);
      if (win) return endGame(state, win.winner, win.reason);
      return { ...state, ...timed(state.settings.daySeconds), phase: 'day' };
    }

    case 'day':
      return { ...state, ...timed(PHASE_SECONDS.vote), phase: 'vote' };

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
  return { ...state, phase: 'gameOver', phaseEndsAt: null, ready: [], picks: {}, winner, winReason };
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
