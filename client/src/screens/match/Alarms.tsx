import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { AlarmView } from '@hv/shared';
import { secondsLeft, useServerNow } from '../../clock';
import { CountdownRing } from '../../fx/Effects';
import { vibrate } from '../../fx/motion';
import { burst } from '../../fx/particles';
import { sfx } from '../../fx/sound';
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

const enter = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25 } };

function DangerOverlay({ view, alarm }: PhaseProps & { alarm: AlarmView }) {
  const { run, error } = useAction();
  const now = useServerNow(100);
  // Siren and buzz every second until answered or expired.
  useEffect(() => {
    const ring = () => {
      sfx.danger();
      vibrate([250, 100, 250]);
    };
    ring();
    const id = setInterval(ring, 1000);
    return () => clearInterval(id);
  }, [alarm.id]);
  return (
    <motion.div className="overlay danger" role="alertdialog" aria-label="Danger" {...enter}>
      <p className="alarm-kicker">Danger</p>
      <CountdownRing endsAt={alarm.endsAt} now={now}>
        {secondsLeft(alarm.endsAt, now)}
      </CountdownRing>
      <p className="lead">{alarm.text}</p>
      {view.public.settings.allowTapButton ? (
        <button className="btn primary charm-btn" onClick={() => run(actions.charm)}>
          Tap charm
        </button>
      ) : (
        <p className="muted">Hold your charm to the phone!</p>
      )}
      <ErrorText error={error} />
    </motion.div>
  );
}

function PersonalCard({ alarm, onDismiss }: { alarm: AlarmView; onDismiss: () => void }) {
  const { run, error } = useAction();
  useEffect(() => {
    sfx.ping();
    vibrate(150);
  }, [alarm.id]);
  const mission = alarm.kind === 'mission';
  return (
    <motion.section
      className={`alarm-card ${alarm.kind}`}
      role="status"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
    >
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
    </motion.section>
  );
}

function VillageOverlay({ view, alarm, onDismiss }: PhaseProps & { alarm: AlarmView; onDismiss: () => void }) {
  const { run, error } = useAction();
  useEffect(() => {
    vibrate([100, 60, 100]);
    if (alarm.kind === 'blackout') sfx.toll();
    if (alarm.kind === 'swapSeats') sfx.ping();
    if (alarm.kind === 'relicRace') {
      sfx.relic();
      burst({ colors: ['#f3c55b', '#fff1b8', '#c99a2e'], count: 60, speed: 420 });
    }
  }, [alarm.id, alarm.kind]);

  // The winner's phone explodes with gold.
  const iWon = alarm.winnerId === view.me.playerId;
  useEffect(() => {
    if (!iWon) return;
    sfx.win();
    burst({ colors: ['#f3c55b', '#fff1b8', '#ffffff', '#c99a2e'], count: 160, speed: 700, duration: 1800 });
  }, [iWon]);

  if (alarm.kind === 'blackout') {
    return (
      <motion.div className="overlay blackout" role="alertdialog" aria-label="Blackout" {...enter}>
        <p className="alarm-kicker">Blackout</p>
        <Countdown endsAt={alarm.endsAt} />
        <p className="lead">{alarm.text}</p>
      </motion.div>
    );
  }

  if (alarm.kind === 'swapSeats') {
    const seats = view.public.players;
    const i = seats.findIndex((p) => p.id === view.me.playerId);
    const left = seats[(i - 1 + seats.length) % seats.length];
    const right = seats[(i + 1) % seats.length];
    return (
      <motion.div className="overlay swap" role="alertdialog" aria-label="Swap seats" {...enter}>
        <p className="alarm-kicker">Swap seats</p>
        <Countdown endsAt={alarm.endsAt} />
        <p className="lead">{alarm.text}</p>
        <p className="big-name small-name">
          Sit between {left.name} and {right.name}
        </p>
        <button className="btn" onClick={onDismiss}>
          I’m in my new seat
        </button>
      </motion.div>
    );
  }

  // Relic race
  return (
    <motion.div className="overlay relic gold-flash" role="alertdialog" aria-label="Relic race" {...enter}>
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
    </motion.div>
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
