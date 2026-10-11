// Types shared by client and server. Grows milestone by milestone.

export type Role = 'villager' | 'possessed';

export type Phase =
  | 'lobby'
  | 'reveal'
  | 'night'
  | 'morning'
  | 'day'
  | 'vote'
  | 'result'
  | 'gameOver';

export interface Settings {
  /** Match-wide midnight clock, in seconds. Possessed win when it runs out. */
  midnightSeconds: number;
  daySeconds: number;
  nightSeconds: number;
  /** When false, alarms and night actions require a real NFC card tap. */
  allowTapButton: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  midnightSeconds: 12 * 60,
  daySeconds: 3 * 60,
  nightSeconds: 30,
  allowTapButton: true,
};

/** Inclusive [min, max] bounds for the numeric settings, in seconds. */
export const SETTING_LIMITS = {
  midnightSeconds: [5 * 60, 30 * 60],
  daySeconds: [60, 5 * 60],
  nightSeconds: [15, 60],
} as const;

/** Fixed lengths of the short phases, in seconds. */
export const PHASE_SECONDS = {
  reveal: 20,
  morning: 8,
  vote: 40,
  result: 10,
} as const;

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 12;
export const MAX_NAME_LENGTH = 16;
/** Room codes avoid I and O so they can't be confused with 1 and 0. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
  alive: boolean;
  /** Only revealed once the player is out, or for everyone at game over. */
  role?: Role;
}

export type WinReason = 'possessedGone' | 'outnumbered' | 'midnight';

export interface NightResult {
  /** Who the Possessed took, or null if nobody was taken. */
  takenId: string | null;
  /** True when the Possessed chose a victim but enough Villagers protected them. */
  saved: boolean;
}

export interface VoteResult {
  eliminatedId: string | null;
  /** Votes received per player id (who voted for whom stays secret). */
  tally: Record<string, number>;
}

/** What every player in the room may see. */
export interface PublicState {
  code: string;
  phase: Phase;
  hostId: string;
  /** In seating order, clockwise around the table. */
  players: PublicPlayer[];
  settings: Settings;
  round: number;
  /** Server timestamps (ms). Use serverNow to correct for the phone's clock. */
  serverNow: number;
  phaseEndsAt: number | null;
  midnightAt: number | null;
  /** How many living players have done this phase's action (ready / night pick / vote). */
  actedCount: number;
  lastNight: NightResult | null;
  lastVote: VoteResult | null;
  winner: Role | null;
  winReason: WinReason | null;
}

/** What only this one player may see. */
export interface PrivateState {
  playerId: string;
  role: Role | null;
  /** Other Possessed players; only ever filled in for the Possessed. */
  partners: string[];
  alive: boolean;
  /** Has tapped their charm this night. */
  charmed: boolean;
  /** This phase's chosen player (night target or vote suspect). */
  pick: string | null;
  /** Possessed only, at night: what each partner has picked. */
  partnerPicks: Record<string, string>;
  /** Reveal phase: has confirmed they saw their role. */
  ready: boolean;
}

export interface ClientView {
  public: PublicState;
  me: PrivateState;
}

/** Stored on the phone so a refresh or lock screen can rejoin the same seat. */
export interface Session {
  code: string;
  token: string;
  playerId: string;
}
