import { useState } from 'react';
import { MAX_HINT_LENGTH } from '@hv/shared';
import { actions } from '../../game';
import { ErrorText, PlayerPicker, useAction, type PhaseProps } from './common';

/** A Spirit's night: once, either whisper a hint to a living player or haunt them with an alarm. */
export function SpiritNight({ view }: PhaseProps) {
  const [mode, setMode] = useState<'hint' | 'haunt'>('hint');
  const [target, setTarget] = useState<string | null>(null);
  const [text, setText] = useState('');
  const { run, error } = useAction();

  if (view.me.spiritActed) return <p className="muted center">Your power is spent for tonight. The village sleeps…</p>;

  const living = view.public.players.filter((p) => p.alive);
  return (
    <section className="stack-center">
      <p className="lead">You drift through the village. Once tonight, you may…</p>
      <div className="row">
        <button className={`btn small ${mode === 'hint' ? 'primary' : ''}`} onClick={() => setMode('hint')}>
          Whisper a hint
        </button>
        <button className={`btn small ${mode === 'haunt' ? 'primary' : ''}`} onClick={() => setMode('haunt')}>
          Haunt someone
        </button>
      </div>
      <p className="muted small center">
        {mode === 'hint'
          ? 'They receive your words at dawn, unsigned.'
          : 'Tomorrow, their phone will sound a danger alarm.'}
      </p>
      <PlayerPicker players={living} selected={target} onPick={setTarget} />
      {mode === 'hint' && (
        <input
          value={text}
          maxLength={MAX_HINT_LENGTH}
          placeholder="One line from beyond…"
          onChange={(e) => setText(e.target.value)}
        />
      )}
      <button
        className="btn primary"
        disabled={!target || (mode === 'hint' && !text.trim())}
        onClick={() => run(() => (mode === 'hint' ? actions.spiritHint(target!, text) : actions.spiritHaunt(target!)))}
      >
        {mode === 'hint' ? 'Send hint' : 'Haunt them'}
      </button>
      <ErrorText error={error} />
    </section>
  );
}
