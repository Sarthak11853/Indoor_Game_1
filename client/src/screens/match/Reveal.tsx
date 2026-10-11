import { actions } from '../../game';
import { ErrorText, nameOf, Progress, useAction, type PhaseProps } from './common';

export function Reveal({ view }: PhaseProps) {
  const { role, partners, ready } = view.me;
  const { run, error } = useAction();
  const possessed = role === 'possessed';

  return (
    <section className="stack-center">
      <div className={`role-card ${possessed ? 'possessed' : 'villager'}`}>
        <p className="muted small">You are</p>
        <p className="role-name">{possessed ? 'Possessed' : 'a Villager'}</p>
        <p className="small">
          {possessed
            ? 'Each night, take a Villager. By day, blend in. Win when you equal the Villagers, or when midnight strikes.'
            : 'Each night, protect someone. By day, find the Possessed and vote them out before midnight.'}
        </p>
        {possessed && (
          <p className="partners">
            {partners.length
              ? `Your partner${partners.length > 1 ? 's' : ''}: ${partners.map((id) => nameOf(view, id)).join(', ')}`
              : 'You walk alone.'}
          </p>
        )}
      </div>
      <p className="muted small center">Keep your screen hidden from the others.</p>
      <button className="btn primary" disabled={ready} onClick={() => run(actions.ready)}>
        {ready ? 'Waiting for the others…' : 'I have seen my role'}
      </button>
      <Progress view={view} label="ready" />
      <ErrorText error={error} />
    </section>
  );
}
