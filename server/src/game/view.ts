import type { ClientView } from '@hv/shared';
import type { GameState } from './types';

/**
 * The only place that decides what a player is allowed to see.
 * Everything sent to a phone goes through here: public state plus that
 * player's own private state, and nothing about anyone else's secrets.
 */
export function viewFor(state: GameState, playerId: string): ClientView {
  return {
    public: {
      code: state.code,
      phase: state.phase,
      hostId: state.hostId,
      players: state.players.map(({ id, name, connected }) => ({ id, name, connected })),
      settings: state.settings,
    },
    me: { playerId },
  };
}
