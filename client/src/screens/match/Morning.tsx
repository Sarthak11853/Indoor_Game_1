import { motion } from 'framer-motion';
import { BurnName, Candlelight } from '../../fx/Effects';
import { nameOf, type PhaseProps } from './common';

export function Morning({ view }: PhaseProps) {
  const night = view.public.lastNight;
  const fade = (delay: number) => ({ initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay, duration: 1 } });

  return (
    <section className="stack-center announcement">
      <Candlelight />
      {night?.takenId ? (
        <>
          <motion.p className="muted" {...fade(0.3)}>
            Dawn breaks. One chair stands empty…
          </motion.p>
          <BurnName name={nameOf(view, night.takenId)} delay={1.6} />
          <motion.p className="lead" {...fade(3.2)}>
            {nameOf(view, night.takenId)} was taken in the night.
          </motion.p>
        </>
      ) : night?.saved ? (
        <motion.p className="lead" {...fade(0.5)}>
          The Possessed struck, but the village’s protection held. Nobody was taken.
        </motion.p>
      ) : (
        <motion.p className="lead" {...fade(0.5)}>
          A quiet night. Nobody was taken.
        </motion.p>
      )}
    </section>
  );
}
