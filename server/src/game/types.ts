import type { AlarmKind, InboxItem, NightResult, Phase, RelicReward, Role, Settings, VoteResult, WinReason } from '@hv/shared';

// The server's full game state. It holds secrets (roles, picks), so it is
// never sent to clients directly; see view.ts for what each player sees.

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  role: Role | null;
  alive: boolean;
}

export interface Alarm {
  id: string;
  kind: AlarmKind;
  /** Who it is aimed at; null for village-wide alarms. */
  targetId: string | null;
  text: string;
  endsAt: number;
  /** Relic race: the winner. Once set, the race is over and only shown until endsAt. */
  winnerId?: string;
}

export interface GameState {
  code: string;
  phase: Phase;
  hostId: string;
  /** Seating order, clockwise around the table. */
  players: Player[];
  settings: Settings;
  /** Linked charm cards: card id -> player id. Kept between matches in the same room. */
  charms: Record<string, string>;
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

  // ── Surprise alarms ──
  /** Alarms currently running. */
  alarms: Alarm[];
  /** When the next alarm fires (only during the day). */
  nextAlarmAt: number | null;
  /** Counter for alarm and inbox ids. */
  seq: number;
  /** Personal alarms received per player, so they are spread fairly. */
  alarmCounts: Record<string, number>;
  relicRaces: number;
  /** Relic card ids that have already granted a bonus this match. */
  usedRelics: string[];
  /** Extra (+) or lost (−) votes this round, by player id. */
  voteBonus: Record<string, number>;
  /** Players who won a relic race and have not chosen their reward yet. */
  relicRewards: string[];
  inbox: Record<string, InboxItem[]>;

  // ── Spirits ──
  /** Spirits who used their power this night. */
  spiritActed: string[];
  /** Hints written tonight, delivered at morning. */
  pendingHints: { to: string; text: string }[];
  /** Players a spirit chose to haunt: each gets a danger alarm next day. */
  haunts: string[];
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
  | { type: 'missionDone'; playerId: string; alarmId: string }
  /** cardId is null for the on-screen fallback button. */
  | { type: 'relic'; playerId: string; cardId: string | null }
  | { type: 'relicReward'; playerId: string; reward: RelicReward }
  | { type: 'spiritHint'; playerId: string; targetId: string; text: string }
  | { type: 'spiritHaunt'; playerId: string; targetId: string }
  | { type: 'playAgain'; by: string }
  /** A physical card was tapped; its meaning depends on the phase and who owns it. */
  | { type: 'cardTap'; playerId: string; cardId: string }
  /** Dev panel: fire an alarm of this kind right now. */
  | { type: 'devAlarm'; kind: AlarmKind }
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
