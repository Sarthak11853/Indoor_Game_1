import { useState } from 'react';
import { motion } from 'framer-motion';
import { sfx } from '../../fx/sound';
import { vibrate } from '../../fx/motion';
import { actions } from '../../game';
import { ErrorText, nameOf, Progress, useAction, type PhaseProps } from './common';

export function Reveal({ view }: PhaseProps) {
  const { role, partners, ready } = view.me;
  const { run, error } = useAction();
  const [flipped, setFlipped] = useState(false);
  const possessed = role === 'possessed';

  function flip() {
    if (flipped) return;
    setFlipped(true);
    sfx.reveal(possessed);
    if (possessed) vibrate([80, 40, 80, 40, 200]);
  }

  return (
    <section className={`stack-center ${flipped && possessed ? 'shake-once' : ''}`}>
      <p className="muted small center">Keep your screen hidden from the others.</p>
      <div className="flip-scene" onClick={flip} role="button" aria-label="Turn over your role card" tabIndex={0}>
        <motion.div
          className="flip-card"
          initial={false}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.8, ease: [0.3, 0.7, 0.3, 1] }}
        >
          <div className="flip-face back">
            <span className="back-sigil" aria-hidden>
              ☾
            </span>
            <p>Tap to turn your card</p>
          </div>
          <div className={`flip-face front role-card ${possessed ? 'possessed flicker' : 'villager glow'}`}>
            <p className="muted small">You are</p>
            <p className="role-name">{possessed ? 'Possessed' : 'a Villager'}</p>
            <p className="small">
              {possessed
                ? 'Each night, take a Villager. By day, blend in. Win when you equal the Villagers, or when midnight strikes.'
                : 'Each night, protect someone. By day, find the Possessed and vote them out before midnight.'}
            </p>
            {possessed && (
              <p className="partners">
                {partners.length
                  ? `Your partner${partners.length > 1 ? 's' : ''}: ${partners.map((id) => nameOf(view, id)).join(', ')}`
                  : 'You walk alone.'}
              </p>
            )}
          </div>
        </motion.div>
      </div>
      {flipped && (
        <motion.button
          className="btn primary"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          disabled={ready}
          onClick={() => run(actions.ready)}
        >
          {ready ? 'Waiting for the others…' : 'I have seen my role'}
        </motion.button>
      )}
      <Progress view={view} label="ready" />
      <ErrorText error={error} />
    </section>
  );
}
