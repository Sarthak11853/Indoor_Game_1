import type { NightResult, Phase, Role, Settings, VoteResult, WinReason } from '@hv/shared';

// The server's full game state. It holds secrets (roles, picks), so it is
// never sent to clients directly; see view.ts for what each player sees.

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  role: Role | null;
  alive: boolean;
}

export interface GameState {
  code: string;
  phase: Phase;
  hostId: string;
  /** Seating order, clockwise around the table. */
  players: Player[];
  settings: Settings;
  round: number;
  phaseEndsAt: number | null;
  /** When the midnight clock strikes; set when the first night begins. */
  midnightAt: number | null;
  /** Reveal: players who confirmed their role. Night: players who tapped their charm. */
  ready: string[];
  /** This phase's picks: night targets or vote suspects, by player id. */
  picks: Record<string, string>;
  lastNight: NightResult | null;
  lastVote: VoteResult | null;
  winner: Role | null;
  winReason: WinReason | null;
}

export type Action =
  | { type: 'join'; playerId: string; name: string }
  | { type: 'leave'; playerId: string }
  | { type: 'kick'; by: string; playerId: string }
  | { type: 'reorder'; by: string; order: string[] }
  | { type: 'settings'; by: string; settings: Partial<Settings> }
  | { type: 'connection'; playerId: string; connected: boolean }
  | { type: 'start'; by: string }
  | { type: 'ready'; playerId: string }
  /** source 'button' is the on-screen fallback; the host can switch it off. */
  | { type: 'charm'; playerId: string; source: 'button' | 'card' }
  | { type: 'pick'; playerId: string; targetId: string }
  | { type: 'skipDay'; by: string }
  | { type: 'playAgain'; by: string }
  /** A timer fired: advance the phase if its time is up. */
  | { type: 'tick' };

/** Everything impure the rules need, passed in so tests are deterministic. */
export interface Context {
  now: number;
  /** Returns a number in [0, 1), like Math.random. */
  rng: () => number;
}

/** A rule was broken. The message is safe to show to the player. */
export class RuleError extends Error {}
