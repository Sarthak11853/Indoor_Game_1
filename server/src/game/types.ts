import type { Phase, Settings } from '@hv/shared';

// The server's full game state. It holds secrets (later: roles), so it is
// never sent to clients directly; see view.ts for what each player sees.

export interface Player {
  id: string;
  name: string;
  connected: boolean;
}

export interface GameState {
  code: string;
  phase: Phase;
  hostId: string;
  /** Seating order, clockwise around the table. */
  players: Player[];
  settings: Settings;
}

export type Action =
  | { type: 'join'; playerId: string; name: string }
  | { type: 'leave'; playerId: string }
  | { type: 'kick'; by: string; playerId: string }
  | { type: 'reorder'; by: string; order: string[] }
  | { type: 'settings'; by: string; settings: Partial<Settings> }
  | { type: 'connection'; playerId: string; connected: boolean };

/** A rule was broken. The message is safe to show to the player. */
export class RuleError extends Error {}
