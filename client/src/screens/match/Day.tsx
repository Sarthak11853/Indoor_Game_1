import { actions } from '../../game';
import { ErrorText, isHost, useAction, type PhaseProps } from './common';

export function Day({ view }: PhaseProps) {
  const { run, error } = useAction();
  return (
    <section className="stack-center">
      <p className="lead">Talk it out. Who among you is Possessed?</p>
      <p className="muted small center">Only words may be traded. The vote opens when the timer runs out.</p>
      {isHost(view) && (
        <button className="btn" onClick={() => run(actions.skipDay)}>
          Start the vote now
        </button>
      )}
      <ErrorText error={error} />
    </section>
  );
}
