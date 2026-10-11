import {
  DEFAULT_SETTINGS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  SETTING_LIMITS,
  type Settings,
} from '@hv/shared';
import { RuleError, type Action, type GameState } from './types';

// The game as a pure state machine: apply(state, action) returns the next state
// or throws a RuleError. No sockets, timers or randomness live here.

export function newGame(code: string, hostId: string, hostName: string): GameState {
  const base: GameState = { code, phase: 'lobby', hostId, players: [], settings: { ...DEFAULT_SETTINGS } };
  return apply(base, { type: 'join', playerId: hostId, name: hostName });
}

export function apply(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'join': {
      inLobby(state);
      if (state.players.length >= MAX_PLAYERS) throw new RuleError('This room is full.');
      const name = cleanName(action.name);
      if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        throw new RuleError('That name is taken in this room.');
      }
      return { ...state, players: [...state.players, { id: action.playerId, name, connected: true }] };
    }

    case 'leave':
      inLobby(state);
      return removePlayer(state, action.playerId);

    case 'kick':
      inLobby(state);
      hostOnly(state, action.by);
      if (action.playerId === action.by) throw new RuleError('Use Leave to leave the room.');
      return removePlayer(state, action.playerId);

    case 'reorder': {
      inLobby(state);
      hostOnly(state, action.by);
      const byId = new Map(state.players.map((p) => [p.id, p]));
      const order = action.order;
      if (order.length !== byId.size || new Set(order).size !== order.length || !order.every((id) => byId.has(id))) {
        throw new RuleError('Seating order must list every player exactly once.');
      }
      return { ...state, players: order.map((id) => byId.get(id)!) };
    }

    case 'settings':
      inLobby(state);
      hostOnly(state, action.by);
      return { ...state, settings: mergeSettings(state.settings, action.settings) };

    case 'connection': {
      getPlayer(state, action.playerId);
      return {
        ...state,
        players: state.players.map((p) => (p.id === action.playerId ? { ...p, connected: action.connected } : p)),
      };
    }
  }
}

function removePlayer(state: GameState, playerId: string): GameState {
  getPlayer(state, playerId);
  const players = state.players.filter((p) => p.id !== playerId);
  // The host role passes to the next seat when the host leaves.
  const hostId = state.hostId === playerId ? (players[0]?.id ?? '') : state.hostId;
  return { ...state, players, hostId };
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

function getPlayer(state: GameState, playerId: string) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new RuleError('That player is not in this room.');
  return player;
}

function inLobby(state: GameState) {
  if (state.phase !== 'lobby') throw new RuleError('The game has already started.');
}

function hostOnly(state: GameState, playerId: string) {
  if (state.hostId !== playerId) throw new RuleError('Only the host can do that.');
}
