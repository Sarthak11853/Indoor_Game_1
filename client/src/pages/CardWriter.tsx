import { useEffect, useState } from 'react';
import { cardUrl, randomCardId } from '@hv/shared';
import { cardIdFromMessage } from '../nfc';
import { isLocalHost, usePublicBase } from '../joinLink';
import { load, save } from '../storage';

// /admin/cards: writes fresh card ids onto blank NFC tags (Android Chrome).
// Every card is identical in kind; the server decides per room which cards
// are charms and which are relics.

interface WrittenCard {
  id: string;
  url: string;
  at: number;
}

export function CardWriter() {
  const detected = usePublicBase();
  const [base, setBase] = useState('');
  const [cards, setCards] = useState<WrittenCard[]>(() => load<WrittenCard[]>('cards') ?? []);
  const [status, setStatus] = useState('');
  const supported = 'NDEFReader' in window;

  useEffect(() => setBase((b) => b || detected || ''), [detected]);
  useEffect(() => save('cards', cards), [cards]);

  const host = (() => {
    try {
      return new URL(base).hostname;
    } catch {
      return '';
    }
  })();
  const temporary = isLocalHost(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host);

  async function writeCard() {
    const id = randomCardId();
    const url = cardUrl(base, id);
    setStatus('Hold a blank card to the back of the phone…');
    try {
      await new NDEFReader().write({ records: [{ recordType: 'url', data: url }] });
      setCards((c) => [{ id, url, at: Date.now() }, ...c]);
      setStatus(`Written: ${id}`);
    } catch (err) {
      setStatus(`Could not write: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  async function checkCard() {
    setStatus('Hold a card to the back of the phone…');
    const controller = new AbortController();
    try {
      const reader = new NDEFReader();
      reader.onreading = (event) => {
        const id = cardIdFromMessage(event.message);
        setStatus(id ? `This card's id: ${id}` : 'This card has no Haunted Village id.');
        controller.abort();
      };
      await reader.scan({ signal: controller.signal });
    } catch (err) {
      setStatus(`Could not read: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  return (
    <main className="screen">
      <h1 className="title small-title">Card writer</h1>
      <p className="muted small">
        Writes a new random card id onto a blank NFC tag (NTAG213/215/216 work well). Use it for every charm and relic.
      </p>

      <label className="field">
        <span>Game address stored on the card</span>
        <input value={base} onChange={(e) => setBase(e.target.value.trim())} inputMode="url" />
      </label>
      {temporary && (
        <p className="error small">
          This looks like a local address. Cards written now only work on this network. Write cards from your deployed
          https address so they keep working.
        </p>
      )}

      {supported ? (
        <div className="row">
          <button className="btn primary" disabled={!base} onClick={writeCard}>
            Write a new card
          </button>
          <button className="btn" onClick={checkCard}>
            Check a card
          </button>
        </div>
      ) : (
        <div className="card">
          <p className="small">
            This phone cannot write cards from the browser (Web NFC needs Chrome on Android over https). You can still
            make cards with an NFC app such as “NFC Tools”: write a URL record with a link generated here.
          </p>
          <button className="btn small" disabled={!base} onClick={() => {
            const id = randomCardId();
            setCards((c) => [{ id, url: cardUrl(base, id), at: Date.now() }, ...c]);
          }}>
            Generate a card link
          </button>
        </div>
      )}
      {status && <p className="lead small">{status}</p>}

      {cards.length > 0 && (
        <section className="card">
          <h2>
            Cards made on this phone <span className="muted small">{cards.length}</span>
          </h2>
          <ul className="card-list">
            {cards.map((c) => (
              <li key={c.id}>
                <code>{c.id}</code>
                <span className="muted small">{c.url}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <a className="btn ghost" href="/">
        Back to the game
      </a>
    </main>
  );
}
