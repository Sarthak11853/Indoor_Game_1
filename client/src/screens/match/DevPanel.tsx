import { ALARM_KINDS } from '@hv/shared';
import { actions } from '../../game';
import { ErrorText, useAction, type PhaseProps } from './common';

/** Shown with ?dev=1 in the URL. Lets you test the game without waiting or without cards. */
export const devMode = new URLSearchParams(location.search).has('dev');

export function DevPanel({ view }: PhaseProps) {
  const { run, error } = useAction();
  if (view.public.phase !== 'day') return null;
  return (
    <details className="dev-panel">
      <summary>Dev tools</summary>
      <p className="muted small">Fire an alarm now:</p>
      <div className="row">
        {ALARM_KINDS.map((kind) => (
          <button key={kind} className="btn small" onClick={() => run(() => actions.devAlarm(kind))}>
            {kind}
          </button>
        ))}
      </div>
      <ErrorText error={error} />
    </details>
  );
}
