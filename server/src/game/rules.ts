// Pure game rules. No sockets, timers or I/O here, so everything is unit-testable.

/** One Possessed per 4 players, minimum 1. */
export function possessedCount(playerCount: number): number {
  return Math.max(1, Math.floor(playerCount / 4));
}
