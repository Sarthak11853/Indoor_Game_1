// Pure game rules. No sockets, timers or I/O here, so everything is unit-testable.
import type { NightResult, Role, VoteResult, WinReason } from '@hv/shared';
import type { GameState, Player } from './types';

/** One Possessed per 4 players, minimum 1. */
export function possessedCount(playerCount: number): number {
  return Math.max(1, Math.floor(playerCount / 4));
}

/** Villager protectors needed to save the Possessed's target. */
export function protectorsNeeded(livingCount: number): number {
  return livingCount <= 5 ? 1 : 2;
}

/** Randomly assigns roles, returning each player's role by id. */
export function assignRoles(playerIds: string[], rng: () => number): Record<string, Role> {
  const shuffled = shuffle(playerIds, rng);
  const possessed = possessedCount(playerIds.length);
  return Object.fromEntries(shuffled.map((id, i) => [id, i < possessed ? 'possessed' : 'villager']));
}

export const living = (state: GameState): Player[] => state.players.filter((p) => p.alive);

/**
 * The Possessed's most-picked target is taken (ties broken at random),
 * unless enough living Villagers chose to protect that same player.
 */
export function resolveNight(state: GameState, rng: () => number): NightResult {
  const alive = living(state);
  const votes = new Map<string, number>();
  for (const p of alive) {
    const target = state.picks[p.id];
    if (p.role === 'possessed' && target) votes.set(target, (votes.get(target) ?? 0) + 1);
  }
  const target = pickTop(votes, rng);
  if (!target) return { takenId: null, saved: false };

  const protectors = alive.filter((p) => p.role === 'villager' && state.picks[p.id] === target).length;
  const saved = protectors >= protectorsNeeded(alive.length);
  return { takenId: saved ? null : target, saved };
}

/** Each living player's vote counts once; a tie at the top eliminates nobody. */
export function resolveVote(state: GameState): VoteResult {
  const tally: Record<string, number> = {};
  for (const p of living(state)) {
    const suspect = state.picks[p.id];
    if (suspect) tally[suspect] = (tally[suspect] ?? 0) + 1;
  }
  const top = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter((id) => tally[id] === top);
  return { eliminatedId: top > 0 && leaders.length === 1 ? leaders[0] : null, tally };
}

export function checkWinner(state: GameState): { winner: Role; reason: WinReason } | null {
  const alive = living(state);
  const possessed = alive.filter((p) => p.role === 'possessed').length;
  if (possessed === 0) return { winner: 'villager', reason: 'possessedGone' };
  if (possessed >= alive.length - possessed) return { winner: 'possessed', reason: 'outnumbered' };
  return null;
}

function pickTop(counts: Map<string, number>, rng: () => number): string | null {
  const top = Math.max(0, ...counts.values());
  if (top === 0) return null;
  const leaders = [...counts].filter(([, n]) => n === top).map(([id]) => id);
  return leaders[Math.floor(rng() * leaders.length)];
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
