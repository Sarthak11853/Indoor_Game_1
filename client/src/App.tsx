import { useEffect } from 'react';
import { actions, useGame } from './game';
import { resumeNfcIfGranted } from './nfc';
import { TapToast } from './nfc/NfcControls';
import { CardWriter } from './pages/CardWriter';
import { TapPage } from './pages/TapPage';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Match } from './screens/match/Match';

export function App() {
  if (location.pathname === '/tap') return <TapPage />;
  if (location.pathname === '/admin/cards') return <CardWriter />;
  return <Game />;
}

function Game() {
  const { connected, resuming, view, notice } = useGame();
  useEffect(() => void resumeNfcIfGranted(), []);

  let screen;
  if (resuming && !view) screen = <Status text="Finding your seat…" />;
  else if (!view) screen = <Home />;
  else if (view.public.phase === 'lobby') screen = <Lobby view={view} />;
  else screen = <Match view={view} />;

  return (
    <>
      {!connected && <div className="banner">Reconnecting to the village…</div>}
      {notice && (
        <button className="banner notice" onClick={actions.dismissNotice}>
          {notice} <span aria-hidden>✕</span>
        </button>
      )}
      {screen}
      <TapToast />
    </>
  );
}

function Status({ text }: { text: string }) {
  return (
    <main className="screen center">
      <p className="muted">{text}</p>
    </main>
  );
}
