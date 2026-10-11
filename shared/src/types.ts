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

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 12;
