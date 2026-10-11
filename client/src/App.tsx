import { actions, useGame } from './game';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Match } from './screens/match/Match';

export function App() {
  const { connected, resuming, view, notice } = useGame();

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
