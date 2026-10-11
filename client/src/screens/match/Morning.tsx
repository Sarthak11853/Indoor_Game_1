import { nameOf, type PhaseProps } from './common';

export function Morning({ view }: PhaseProps) {
  const night = view.public.lastNight;
  return (
    <section className="stack-center announcement">
      {night?.takenId ? (
        <>
          <p className="big-name">{nameOf(view, night.takenId)}</p>
          <p className="lead">was taken in the night.</p>
        </>
      ) : night?.saved ? (
        <p className="lead">The Possessed struck, but the village’s protection held. Nobody was taken.</p>
      ) : (
        <p className="lead">A quiet night. Nobody was taken.</p>
      )}
    </section>
  );
}
