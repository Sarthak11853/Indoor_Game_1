import { useState, type FormEvent } from 'react';
import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH } from '@hv/shared';
import { actions } from '../game';
import { load, save } from '../storage';

const linkedCode = new URLSearchParams(location.search).get('room')?.toUpperCase().slice(0, ROOM_CODE_LENGTH) ?? '';

export function Home() {
  const [name, setName] = useState(load<string>('name') ?? '');
  const [code, setCode] = useState(linkedCode);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action: () => ReturnType<typeof actions.create>) {
    if (!name.trim()) return setError('Enter your name first.');
    save('name', name.trim());
    setBusy(true);
    const res = await action();
    setBusy(false);
    if (!res.ok) return setError(res.error);
    // Drop ?room= from the address bar so a later refresh doesn't prefill it again.
    const url = new URL(location.href);
    url.searchParams.delete('room');
    history.replaceState(null, '', url);
  }

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== ROOM_CODE_LENGTH) return setError('Room codes have 4 letters.');
    void run(() => actions.join(code, name));
  };

  return (
    <main className="screen center">
      <h1 className="title">Haunted Village</h1>
      <p className="muted">Midnight is coming. Not everyone at this table is who they seem.</p>

      <form className="stack" onSubmit={onJoin}>
        <label className="field">
          <span>Your name</span>
          <input
            value={name}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="nickname"
            placeholder="e.g. Ana"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Room code</span>
          <input
            className="code-input"
            value={code}
            maxLength={ROOM_CODE_LENGTH}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABCD"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
        </label>
        <button className="btn primary" disabled={busy}>
          Join room
        </button>

        {!linkedCode && (
          <>
            <div className="divider">or</div>
            <button type="button" className="btn" disabled={busy} onClick={() => run(() => actions.create(name))}>
              Create a new room
            </button>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
