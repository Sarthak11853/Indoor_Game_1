import { useEffect, useState } from 'react';
import { parseCardId, type AckResult, type Session } from '@hv/shared';
import { load } from '../storage';

// Opened by the phone itself when a card is tapped outside the game page
// (always on iPhone; on Android when the game isn't open). It reports the tap
// for the saved session, then sends the player back to the game.

type Status = { kind: 'working' } | { kind: 'done'; ok: boolean; message: string };

const cardId = parseCardId(new URLSearchParams(location.search).get('card') ?? '');
const session = load<Session>('session');

export function TapPage() {
  const [status, setStatus] = useState<Status>({ kind: 'working' });

  useEffect(() => {
    if (!cardId || !session) return;
    fetch('/api/tap', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: session.code, token: session.token, cardId }),
    })
      .then((r) => r.json() as Promise<AckResult<{ message: string }>>)
      .then((res) => {
        setStatus({ kind: 'done', ok: res.ok, message: res.ok ? res.message : res.error });
        if (res.ok) setTimeout(() => location.replace('/'), 1500);
      })
      .catch(() => setStatus({ kind: 'done', ok: false, message: 'Could not reach the village. Check your connection.' }));
  }, []);

  let body;
  if (!cardId) body = <p className="lead">This card is not a Haunted Village card.</p>;
  else if (!session)
    body = (
      <>
        <p className="lead">A Haunted Village card.</p>
        <p className="muted">Join a game on this phone first, then tap it again.</p>
      </>
    );
  else if (status.kind === 'working') body = <p className="lead">Reading the card…</p>;
  else
    body = (
      <>
        <p className={`tap-result ${status.ok ? 'ok' : 'bad'}`}>{status.ok ? '✓' : '✕'}</p>
        <p className="lead">{status.message}</p>
        {status.ok && <p className="muted small">Returning to the game…</p>}
      </>
    );

  return (
    <main className="screen center">
      {body}
      <a className="btn" href="/">
        Back to the game
      </a>
      {cardId && <p className="muted small">Card {cardId}</p>}
    </main>
  );
}
