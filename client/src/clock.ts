import { useEffect, useState } from 'react';
import { useGame } from './game';

/** Re-renders a few times a second and returns the server's current time. */
export function useServerNow(intervalMs = 250): number {
  const { clockOffset } = useGame();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return Date.now() + clockOffset;
}

/** Whole seconds left until a server timestamp (never negative). */
export const secondsLeft = (endsAt: number | null, now: number) =>
  endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));

export const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
