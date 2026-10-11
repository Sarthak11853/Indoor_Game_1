import { nameOf, type PhaseProps } from './common';

export function Result({ view }: PhaseProps) {
  const vote = view.public.lastVote;
  const out = view.public.players.find((p) => p.id === vote?.eliminatedId);
  const tally = Object.entries(vote?.tally ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <section className="stack-center announcement">
      {out ? (
        <>
          <p className="big-name">{out.name}</p>
          <p className="lead">
            is cast out. They were{' '}
            <strong className={out.role === 'possessed' ? 'text-danger' : ''}>
              {out.role === 'possessed' ? 'Possessed!' : 'a Villager.'}
            </strong>
          </p>
        </>
      ) : (
        <p className="lead">{tally.length ? 'A tie. Nobody is cast out.' : 'Nobody voted. Nobody is cast out.'}</p>
      )}
      {tally.length > 0 && (
        <ul className="tally">
          {tally.map(([id, votes]) => (
            <li key={id}>
              <span>{nameOf(view, id)}</span>
              <span>
                {votes} vote{votes > 1 ? 's' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
