import type { AlarmView, ClientView } from '@hv/shared';
import { living, voteWeight } from './rules';
import type { Alarm, GameState } from './types';

/**
 * The only place that decides what a player is allowed to see.
 * Everything sent to a phone goes through here: public state plus that
 * player's own private state, and nothing about anyone else's secrets.
 */
export function viewFor(state: GameState, playerId: string, now: number): ClientView {
  const me = state.players.find((p) => p.id === playerId);
  const role = me?.role ?? null;
  const partners =
    role === 'possessed' ? state.players.filter((p) => p.role === 'possessed' && p.id !== playerId).map((p) => p.id) : [];

  return {
    public: {
      code: state.code,
      phase: state.phase,
      hostId: state.hostId,
      players: state.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        alive: p.alive,
        // A role becomes public only once its owner is out, or when the game ends.
        ...(p.role && (!p.alive || state.phase === 'gameOver') ? { role: p.role } : {}),
      })),
      settings: state.settings,
      round: state.round,
      serverNow: now,
      phaseEndsAt: state.phaseEndsAt,
      midnightAt: state.midnightAt,
      actedCount: actedCount(state),
      lastNight: state.lastNight,
      lastVote: state.lastVote,
      winner: state.winner,
      winReason: state.winReason,
      alarm: toView(state.alarms.find((a) => a.targetId === null)),
    },
    me: {
      playerId,
      role,
      partners,
      alive: me?.alive ?? false,
      charmed: state.phase === 'night' && state.ready.includes(playerId),
      pick: state.picks[playerId] ?? null,
      partnerPicks:
        state.phase === 'night'
          ? Object.fromEntries(partners.filter((id) => state.picks[id]).map((id) => [id, state.picks[id]]))
          : {},
      ready: state.phase === 'reveal' && state.ready.includes(playerId),
      // Personal alarms (missions especially) reveal a role, so only their target sees them.
      alarms: state.alarms.filter((a) => a.targetId === playerId).map((a) => toView(a)!),
      inbox: state.inbox[playerId] ?? [],
      voteWeight: voteWeight(state, playerId),
      relicReward: state.relicRewards.includes(playerId),
      spiritActed: state.spiritActed.includes(playerId),
    },
  };
}

function toView(alarm: Alarm | undefined): AlarmView | null {
  if (!alarm) return null;
  const { id, kind, text, endsAt, winnerId } = alarm;
  return { id, kind, text, endsAt, ...(winnerId ? { winnerId } : {}) };
}

function actedCount(state: GameState): number {
  if (state.phase === 'reveal') return state.ready.length;
  if (state.phase === 'night' || state.phase === 'vote') return living(state).filter((p) => state.picks[p.id]).length;
  return 0;
}
