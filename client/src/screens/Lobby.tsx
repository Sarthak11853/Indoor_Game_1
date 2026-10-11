import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { MAX_PLAYERS, MIN_PLAYERS, SETTING_LIMITS, type ClientView, type Settings } from '@hv/shared';
import { actions } from '../game';
import { mmss } from '../clock';

export function Lobby({ view }: { view: ClientView }) {
  const { code, players, hostId, settings } = view.public;
  const me = view.me.playerId;
  const isHost = me === hostId;
  const joinUrl = `${location.origin}/?room=${code}`;
  const missing = Math.max(0, MIN_PLAYERS - players.length);
  const [error, setError] = useState('');

  const report = (res: { ok: boolean; error?: string }) => setError(res.ok ? '' : (res.error ?? ''));

  const move = (index: number, delta: number) => {
    const order = players.map((p) => p.id);
    [order[index], order[index + delta]] = [order[index + delta], order[index]];
    void actions.reorder(order).then(report);
  };

  return (
    <main className="screen">
      <header className="center stack-tight">
        <p className="muted small">Room code</p>
        <p className="room-code">{code}</p>
        <QrCode text={joinUrl} />
        <ShareButton url={joinUrl} code={code} />
      </header>

      <section className="card">
        <h2>
          Seating <span className="muted small">{players.length}/{MAX_PLAYERS}</span>
        </h2>
        <p className="muted small">Sit in this order, clockwise around the table.</p>
        <ol className="players">
          {players.map((p, i) => (
            <li key={p.id} className={p.connected ? '' : 'away'}>
              <span className="seat">{i + 1}</span>
              <span className="name">
                {p.name}
                {p.id === hostId && <span title="Host"> 👑</span>}
                {p.id === me && <span className="muted"> (you)</span>}
                {!p.connected && <span className="muted small"> · away</span>}
              </span>
              {isHost && (
                <span className="row-actions">
                  <button aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    ▲
                  </button>
                  <button
                    aria-label={`Move ${p.name} down`}
                    disabled={i === players.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ▼
                  </button>
                  {p.id !== me && (
                    <button aria-label={`Remove ${p.name}`} onClick={() => actions.kick(p.id).then(report)}>
                      ✕
                    </button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <SettingsCard settings={settings} editable={isHost} onError={report} />

      {error && <p className="error">{error}</p>}
      {missing > 0 ? (
        <p className="muted center">{`Waiting for ${missing} more player${missing > 1 ? 's' : ''}…`}</p>
      ) : isHost ? (
        <button className="btn primary" onClick={() => actions.start().then(report)}>
          Begin the night
        </button>
      ) : (
        <p className="muted center">Waiting for the host to begin…</p>
      )}
      <button className="btn ghost" onClick={() => actions.leave()}>
        Leave room
      </button>
    </main>
  );
}

function QrCode({ text }: { text: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: 360, color: { dark: '#0b0a10', light: '#ece6f5' } })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [text]);
  return src ? <img className="qr" src={src} alt={`QR code to join: ${text}`} /> : null;
}

function ShareButton({ url, code }: { url: string; code: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: 'Haunted Village', text: `Join room ${code}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // User cancelled the share sheet or clipboard is blocked.
    }
  }
  return (
    <button className="btn small" onClick={share}>
      {copied ? 'Link copied' : 'Share invite link'}
    </button>
  );
}


const NUMERIC: { key: keyof typeof SETTING_LIMITS; label: string; step: number }[] = [
  { key: 'midnightSeconds', label: 'Midnight clock', step: 60 },
  { key: 'daySeconds', label: 'Day length', step: 30 },
  { key: 'nightSeconds', label: 'Night length', step: 5 },
];

function SettingsCard({
  settings,
  editable,
  onError,
}: {
  settings: Settings;
  editable: boolean;
  onError: (res: { ok: boolean; error?: string }) => void;
}) {
  const update = (patch: Partial<Settings>) => actions.updateSettings(patch).then(onError);

  return (
    <section className="card">
      <h2>Settings</h2>
      {NUMERIC.map(({ key, label, step }) => {
        const [min, max] = SETTING_LIMITS[key];
        const value = settings[key];
        return (
          <div className="setting" key={key}>
            <span>{label}</span>
            {editable && (
              <button aria-label={`Less ${label}`} disabled={value <= min} onClick={() => update({ [key]: value - step })}>
                −
              </button>
            )}
            <span className="value">{mmss(value)}</span>
            {editable && (
              <button aria-label={`More ${label}`} disabled={value >= max} onClick={() => update({ [key]: value + step })}>
                +
              </button>
            )}
          </div>
        );
      })}
      <label className="setting">
        <span>On-screen tap button</span>
        <input
          type="checkbox"
          checked={settings.allowTapButton}
          disabled={!editable}
          onChange={(e) => update({ allowTapButton: e.target.checked })}
        />
      </label>
    </section>
  );
}
