import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShatterCard } from '../../fx/Effects';
import { prefersReducedMotion } from '../../fx/motion';
import { sfx } from '../../fx/sound';
import { nameOf, type PhaseProps } from './common';

type Stage = 'drumroll' | 'card' | 'shatter';

export function Result({ view }: PhaseProps) {
  const vote = view.public.lastVote;
  const out = view.public.players.find((p) => p.id === vote?.eliminatedId);
  const tally = Object.entries(vote?.tally ?? {}).sort((a, b) => b[1] - a[1]);
  const [stage, setStage] = useState<Stage>('drumroll');

  // Suspense: drumroll, then the verdict card, then (if someone is out) it shatters.
  // Keyed on the id (not the player object, which is new in every server update).
  const outId = out?.id ?? null;
  useEffect(() => {
    const roll = prefersReducedMotion() ? 800 : 2400;
    sfx.drumroll(roll / 1000);
    const timers = [setTimeout(() => setStage('card'), roll)];
    if (outId) {
      timers.push(
        setTimeout(() => {
          setStage('shatter');
          sfx.shatter();
        }, roll + 1600),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [outId]);

  if (stage === 'drumroll') {
    return (
      <section className="stack-center announcement">
        <p className="lead suspense">The village has decided…</p>
      </section>
    );
  }

  const evil = out?.role === 'possessed';
  return (
    <section className="stack-center announcement">
      {out ? (
        <>
          <div className="verdict-slot">
            <ShatterCard broken={stage === 'shatter'} className={`verdict-card ${evil ? 'possessed' : 'villager'}`}>
              <p className="big-name">{out.name}</p>
              <p className={evil ? 'text-danger' : 'muted'}>{evil ? 'Possessed' : 'Villager'}</p>
            </ShatterCard>
          </div>
          <motion.p className="lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            {out.name} is cast out. They were{' '}
            <strong className={evil ? 'text-danger' : ''}>{evil ? 'Possessed!' : 'a Villager.'}</strong>
          </motion.p>
        </>
      ) : (
        <motion.p className="lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {tally.length ? 'A tie. Nobody is cast out.' : 'Nobody voted. Nobody is cast out.'}
        </motion.p>
      )}
      {tally.length > 0 && (
        <ul className="tally">
          {tally.map(([id, votes], i) => (
            <motion.li key={id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.1 }}>
              <span>{nameOf(view, id)}</span>
              <span>
                {votes} vote{votes > 1 ? 's' : ''}
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
