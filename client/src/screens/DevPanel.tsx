import { useState } from 'react';
import { ALARM_KINDS, parseCardId, randomCardId, type ClientView } from '@hv/shared';
import { actions } from '../game';
import { onCardTapped } from '../nfc';
import { ErrorText, useAction } from './match/common';

/**
 * Shown with ?dev=1 in the URL during development (npm run dev). Hidden in production
 * builds so players can't fake card taps in a real match.
 */
export const devMode = import.meta.env.DEV && new URLSearchParams(location.search).has('dev');

export function DevPanel({ view }: { view: ClientView }) {
  const { run, error } = useAction();
  const [typed, setTyped] = useState('');
  const tap = (cardId: string) => run(() => onCardTapped(cardId));
  const typedId = parseCardId(typed);

  return (
    <details className="dev-panel">
      <summary>Dev tools</summary>
      <p className="muted small">Simulate a card tap:</p>
      <div className="row">
        {view.me.charmId ? (
          <button className="btn small" onClick={() => tap(view.me.charmId!)}>
            My charm
          </button>
        ) : (
          <button className="btn small" onClick={() => tap(`charm-${view.me.playerId}`)}>
            Link a charm
          </button>
        )}
        <button className="btn small" onClick={() => tap(`relic-${randomCardId(6)}`)}>
          A relic card
        </button>
      </div>
      <div className="row">
        <input value={typed} placeholder="Card id or URL" onChange={(e) => setTyped(e.target.value)} />
        <button className="btn small" disabled={!typedId} onClick={() => typedId && tap(typedId)}>
          Tap it
        </button>
      </div>

      {view.public.phase === 'day' && (
        <>
          <p className="muted small">Fire an alarm now:</p>
          <div className="row">
            {ALARM_KINDS.map((kind) => (
              <button key={kind} className="btn small" onClick={() => run(() => actions.devAlarm(kind))}>
                {kind}
              </button>
            ))}
          </div>
        </>
      )}
      <ErrorText error={error} />
    </details>
  );
}
