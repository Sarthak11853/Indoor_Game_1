import type { WinReason } from '@hv/shared';
import { actions } from '../../game';
import { ErrorText, isHost, useAction, type PhaseProps } from './common';

const REASONS: Record<WinReason, string> = {
  possessedGone: 'Every Possessed has been cast out.',
  outnumbered: 'The Possessed now equal the Villagers.',
  midnight: 'Midnight struck before the village found them.',
};

export function GameOver({ view }: PhaseProps) {
  const { winner, winReason, players } = view.public;
  const { run, error } = useAction();
  const iWon = view.me.role === winner;

  return (
    <section className="stack-center">
      <div className={`role-card ${winner === 'possessed' ? 'possessed' : 'villager'}`}>
        <p className="role-name">{winner === 'possessed' ? 'The Possessed win' : 'The Villagers win'}</p>
        {winReason && <p className="small">{REASONS[winReason]}</p>}
        <p className="small">{iWon ? 'You won!' : 'You lost.'}</p>
      </div>
      <ul className="tally">
        {players.map((p) => (
          <li key={p.id} className={p.alive ? '' : 'dead'}>
            <span>
              {p.name}
              {!p.alive && ' ✝'}
            </span>
            <span className={p.role === 'possessed' ? 'text-danger' : 'muted'}>
              {p.role === 'possessed' ? 'Possessed' : 'Villager'}
            </span>
          </li>
        ))}
      </ul>
      {isHost(view) ? (
        <button className="btn primary" onClick={() => run(actions.playAgain)}>
          Play again
        </button>
      ) : (
        <p className="muted small center">Waiting for the host to start another match…</p>
      )}
      <ErrorText error={error} />
    </section>
  );
}
