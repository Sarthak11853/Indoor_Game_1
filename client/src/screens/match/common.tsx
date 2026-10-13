import { useState } from 'react';
import type { AckResult, ClientView, PublicPlayer } from '@hv/shared';

export interface PhaseProps {
  view: ClientView;
}

/** Runs a server action and keeps its error message for display. */
export function useAction() {
  const [error, setError] = useState('');
  const run = async (action: () => Promise<AckResult>) => {
    const res = await action();
    setError(res.ok ? '' : res.error);
  };
  return { run, error };
}

export function ErrorText({ error }: { error: string }) {
  return error ? <p className="error">{error}</p> : null;
}

export const nameOf = (view: ClientView, id: string | null | undefined) =>
  view.public.players.find((p) => p.id === id)?.name ?? 'Someone';

export const isHost = (view: ClientView) => view.public.hostId === view.me.playerId;

export function PlayerPicker({
  players,
  selected,
  onPick,
  note,
}: {
  players: PublicPlayer[];
  selected: string | null;
  onPick: (id: string) => void;
  /** Optional small label per player, e.g. a partner's pick. */
  note?: (p: PublicPlayer) => string | undefined;
}) {
  return (
    <ul className="picker">
      {players.map((p) => (
        <li key={p.id}>
          <button className={p.id === selected ? 'chosen' : ''} aria-pressed={p.id === selected} onClick={() => onPick(p.id)}>
            <span>{p.name}</span>
            {note?.(p) && <span className="muted small">{note(p)}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Progress({ view, label }: PhaseProps & { label: string }) {
  const living = view.public.players.filter((p) => p.alive).length;
  return (
    <p className="muted small center">
      {view.public.actedCount}/{living} {label}
    </p>
  );
}
