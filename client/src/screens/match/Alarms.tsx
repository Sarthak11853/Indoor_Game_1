import { useEffect, useState } from 'react';
import type { AlarmView } from '@hv/shared';
import { secondsLeft, useServerNow } from '../../clock';
import { actions } from '../../game';
import { ErrorText, nameOf, PlayerPicker, useAction, type PhaseProps } from './common';

/** Everything an alarm puts on screen: personal alarms, village-wide alarms and relic rewards. */
export function Alarms({ view }: PhaseProps) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const dismiss = (id: string) => setDismissed((d) => [...d, id]);
  const mine = view.me.alarms.filter((a) => !dismissed.includes(a.id));
  const danger = mine.find((a) => a.kind === 'danger');
  const village = view.public.alarm && !dismissed.includes(view.public.alarm.id) ? view.public.alarm : null;

  return (
    <>
      {mine
        .filter((a) => a.kind !== 'danger')
        .map((a) => (
          <PersonalCard key={a.id} alarm={a} onDismiss={() => dismiss(a.id)} />
        ))}
      {view.me.relicReward && <RelicReward view={view} />}
      {village && <VillageOverlay view={view} alarm={village} onDismiss={() => dismiss(village.id)} />}
      {danger && <DangerOverlay view={view} alarm={danger} />}
    </>
  );
}

function Countdown({ endsAt }: { endsAt: number }) {
  const now = useServerNow(200);
  return <span className="alarm-count">{secondsLeft(endsAt, now)}</span>;
}

const buzz = (pattern: number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration unsupported or blocked: skip silently.
  }
};

function DangerOverlay({ view, alarm }: PhaseProps & { alarm: AlarmView }) {
  const { run, error } = useAction();
  useEffect(() => buzz([300, 100, 300, 100, 300]), [alarm.id]);
  return (
    <div className="overlay danger" role="alertdialog" aria-label="Danger">
      <p className="alarm-kicker">Danger</p>
      <Countdown endsAt={alarm.endsAt} />
      <p className="lead">{alarm.text}</p>
      {view.public.settings.allowTapButton ? (
        <button className="btn primary charm-btn" onClick={() => run(actions.charm)}>
          Tap charm
        </button>
      ) : (
        <p className="muted">Hold your charm to the phone!</p>
      )}
      <ErrorText error={error} />
    </div>
  );
}

function PersonalCard({ alarm, onDismiss }: { alarm: AlarmView; onDismiss: () => void }) {
  const { run, error } = useAction();
  useEffect(() => buzz([150]), [alarm.id]);
  const mission = alarm.kind === 'mission';
  return (
    <section className={`alarm-card ${alarm.kind}`} role="status">
      <div className="alarm-card-head">
        <span className="alarm-kicker">{mission ? 'Secret mission' : 'A whisper'}</span>
        {mission && <Countdown endsAt={alarm.endsAt} />}
      </div>
      <p>{alarm.text}</p>
      {mission ? (
        <button className="btn primary small" onClick={() => run(() => actions.missionDone(alarm.id))}>
          I did it!
        </button>
      ) : (
        <button className="btn small" onClick={onDismiss}>
          Got it
        </button>
      )}
      <ErrorText error={error} />
    </section>
  );
}

function VillageOverlay({ view, alarm, onDismiss }: PhaseProps & { alarm: AlarmView; onDismiss: () => void }) {
  const { run, error } = useAction();
  useEffect(() => buzz([100, 60, 100]), [alarm.id]);

  if (alarm.kind === 'blackout') {
    return (
      <div className="overlay blackout" role="alertdialog" aria-label="Blackout">
        <p className="alarm-kicker">Blackout</p>
        <Countdown endsAt={alarm.endsAt} />
        <p className="lead">{alarm.text}</p>
      </div>
    );
  }

  if (alarm.kind === 'swapSeats') {
    const seats = view.public.players;
    const i = seats.findIndex((p) => p.id === view.me.playerId);
    const left = seats[(i - 1 + seats.length) % seats.length];
    const right = seats[(i + 1) % seats.length];
    return (
      <div className="overlay swap" role="alertdialog" aria-label="Swap seats">
        <p className="alarm-kicker">Swap seats</p>
        <Countdown endsAt={alarm.endsAt} />
        <p className="lead">{alarm.text}</p>
        <p className="big-name small-name">
          Sit between {left.name} and {right.name}
        </p>
        <button className="btn" onClick={onDismiss}>
          I’m in my new seat
        </button>
      </div>
    );
  }

  // Relic race
  return (
    <div className="overlay relic" role="alertdialog" aria-label="Relic race">
      <p className="alarm-kicker">Relic race</p>
      {alarm.winnerId ? (
        <p className="lead">{alarm.winnerId === view.me.playerId ? 'You' : nameOf(view, alarm.winnerId)} claimed the relic!</p>
      ) : (
        <>
          <Countdown endsAt={alarm.endsAt} />
          <p className="lead">{alarm.text}</p>
          {view.me.alive &&
            (view.public.settings.allowTapButton ? (
              <button className="btn primary charm-btn relic-btn" onClick={() => run(actions.relic)}>
                Tap relic
              </button>
            ) : (
              <p className="gold">Grab a relic card from the table and tap it!</p>
            ))}
        </>
      )}
      <ErrorText error={error} />
    </div>
  );
}

function RelicReward({ view }: PhaseProps) {
  const [peeking, setPeeking] = useState(false);
  const { run, error } = useAction();
  return (
    <section className="alarm-card relic-reward">
      <span className="alarm-kicker">Relic reward</span>
      {peeking ? (
        <>
          <p>Whose true nature will the relic show you?</p>
          <PlayerPicker
            players={view.public.players.filter((p) => p.id !== view.me.playerId)}
            selected={null}
            onPick={(id) => run(() => actions.relicReward({ choice: 'peek', targetId: id }))}
          />
        </>
      ) : (
        <div className="row">
          <button className="btn primary small" onClick={() => run(() => actions.relicReward({ choice: 'vote' }))}>
            Extra vote
          </button>
          <button className="btn small" onClick={() => setPeeking(true)}>
            Peek at a role
          </button>
        </div>
      )}
      <ErrorText error={error} />
    </section>
  );
}
