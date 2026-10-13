import { actions } from '../../game';
import { ErrorText, PlayerPicker, Progress, useAction, type PhaseProps } from './common';

export function Vote({ view }: PhaseProps) {
  const { me } = view;
  const { run, error } = useAction();

  return (
    <section className="stack-center">
      {me.alive && me.voteWeight === 0 ? (
        <p className="lead">The darkness took your voice. You cannot vote this round.</p>
      ) : me.alive ? (
        <>
          <p className="lead">Secretly pick your suspect.</p>
          {me.voteWeight > 1 && <p className="center gold">Your vote counts {me.voteWeight}×</p>}
          <PlayerPicker
            players={view.public.players.filter((p) => p.alive && p.id !== me.playerId)}
            selected={me.pick}
            onPick={(id) => run(() => actions.pick(id))}
          />
        </>
      ) : (
        <p className="muted center">The living are voting…</p>
      )}
      <Progress view={view} label="have voted" />
      <ErrorText error={error} />
    </section>
  );
}
