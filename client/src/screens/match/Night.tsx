import { actions } from '../../game';
import { ErrorText, nameOf, PlayerPicker, Progress, useAction, type PhaseProps } from './common';
import { SpiritNight } from './SpiritNight';

export function Night({ view }: PhaseProps) {
  const { me } = view;
  const { run, error } = useAction();
  if (!me.alive) return <SpiritNight view={view} />;

  const possessed = me.role === 'possessed';
  const targets = view.public.players.filter(
    (p) => p.alive && p.id !== me.playerId && !(possessed && me.partners.includes(p.id)),
  );

  return (
    <section className="stack-center">
      {!me.charmed ? (
        <>
          <p className="lead">Everyone, tap your charm.</p>
          {view.public.settings.allowTapButton ? (
            <button className="btn primary charm-btn" onClick={() => run(actions.charm)}>
              Tap charm
            </button>
          ) : (
            <p className="muted center">Hold your physical charm to the phone.</p>
          )}
        </>
      ) : (
        <>
          <p className="lead">{possessed ? 'Who will you take tonight?' : 'Who will you protect tonight?'}</p>
          <PlayerPicker
            players={targets}
            selected={me.pick}
            onPick={(id) => run(() => actions.pick(id))}
            note={(p) => {
              const by = Object.keys(me.partnerPicks).filter((partner) => me.partnerPicks[partner] === p.id);
              return by.length ? `chosen by ${by.map((id) => nameOf(view, id)).join(', ')}` : undefined;
            }}
          />
          {me.pick && <p className="muted small center">You can change your mind until dawn.</p>}
        </>
      )}
      <Progress view={view} label="have chosen" />
      <ErrorText error={error} />
    </section>
  );
}
