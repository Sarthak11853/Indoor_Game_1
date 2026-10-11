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
}

/** What every player in the room may see. */
export interface PublicState {
  code: string;
  phase: Phase;
  hostId: string;
  /** In seating order, clockwise around the table. */
  players: PublicPlayer[];
  settings: Settings;
}

/** What only this one player may see. */
export interface PrivateState {
  playerId: string;
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
