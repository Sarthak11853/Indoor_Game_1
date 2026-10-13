import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { prefersReducedMotion } from './motion';
import { setMuted, useMuted } from './sound';

/** Night: dimmed sky, a faint moon in the corner and fog drifting across. */
export function NightSky() {
  return (
    <div className="night-sky" aria-hidden>
      <div className="moon" />
      <div className="fog f1" />
      <div className="fog f2" />
      <div className="fog f3" />
    </div>
  );
}

/** Morning: warm candle light fading in from below. */
export function Candlelight() {
  return <div className="candlelight" aria-hidden />;
}

/** A ring that empties as time runs out; shakes while running. */
export function CountdownRing({ endsAt, now, children }: { endsAt: number; now: number; children: React.ReactNode }) {
  // The ring's full length is whatever was left when it first appeared.
  const [total] = useState(() => Math.max(1, endsAt - now));
  const left = Math.max(0, endsAt - now);
  const r = 54;
  const length = 2 * Math.PI * r;
  return (
    <div className="ring shake-loop">
      <svg viewBox="0 0 120 120" width="150" height="150" aria-hidden>
        <circle cx="60" cy="60" r={r} className="ring-track" />
        <circle
          cx="60"
          cy="60"
          r={r}
          className="ring-bar"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - left / total)}
        />
      </svg>
      <span className="ring-label">{children}</span>
    </div>
  );
}

/** The taken player's name: shown, then burns away letter by letter like paper. */
export function BurnName({ name, delay = 1.2 }: { name: string; delay?: number }) {
  const reduced = prefersReducedMotion();
  // Each letter catches fire at a slightly different moment.
  const offsets = useMemo(() => [...name].map(() => Math.random() * 0.6), [name]);
  if (reduced) {
    return (
      <motion.p className="big-name" initial={{ opacity: 1 }} animate={{ opacity: 0.25 }} transition={{ delay, duration: 1.5 }}>
        {name}
      </motion.p>
    );
  }
  return (
    <p className="big-name burn" aria-label={name}>
      {[...name].map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={{ opacity: 1, y: 0, color: '#ece6f5' }}
          animate={{
            color: ['#ece6f5', '#ffd08a', '#ff6a1f', '#3a1a10'],
            opacity: [1, 1, 1, 0],
            y: [0, 0, -4, -18],
            filter: ['blur(0px)', 'blur(0px)', 'blur(1px)', 'blur(4px)'],
          }}
          transition={{ delay: delay + offsets[i], duration: 1.6, times: [0, 0.3, 0.7, 1] }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </p>
  );
}

const SHARDS = [
  'polygon(0 0, 45% 0, 30% 40%, 0 30%)',
  'polygon(45% 0, 100% 0, 100% 25%, 55% 45%, 30% 40%)',
  'polygon(0 30%, 30% 40%, 25% 70%, 0 75%)',
  'polygon(30% 40%, 55% 45%, 60% 75%, 25% 70%)',
  'polygon(55% 45%, 100% 25%, 100% 65%, 60% 75%)',
  'polygon(0 75%, 25% 70%, 40% 100%, 0 100%)',
  'polygon(25% 70%, 60% 75%, 70% 100%, 40% 100%)',
  'polygon(60% 75%, 100% 65%, 100% 100%, 70% 100%)',
];

/** A card that flies apart into shards once `broken` turns true. */
export function ShatterCard({ broken, className, children }: { broken: boolean; className?: string; children: React.ReactNode }) {
  const reduced = prefersReducedMotion();
  const flights = useMemo(
    () => SHARDS.map(() => ({ x: (Math.random() - 0.5) * 360, y: 120 + Math.random() * 260, rotate: (Math.random() - 0.5) * 140 })),
    [],
  );
  if (!broken) return <div className={className}>{children}</div>;
  if (reduced) {
    return (
      <motion.div className={className} animate={{ opacity: 0 }} transition={{ duration: 0.8 }}>
        {children}
      </motion.div>
    );
  }
  return (
    <div className="shatter-wrap">
      {SHARDS.map((clip, i) => (
        <motion.div
          key={i}
          className={`${className ?? ''} shard`}
          style={{ clipPath: clip }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ ...flights[i], opacity: 0 }}
          transition={{ duration: 1.4, ease: [0.2, 0.7, 0.4, 1], opacity: { delay: 0.45, duration: 0.95 } }}
        >
          {children}
        </motion.div>
      ))}
    </div>
  );
}

export function MuteButton() {
  const muted = useMuted();
  return (
    <button className="mute-btn" aria-label={muted ? 'Turn sound on' : 'Turn sound off'} onClick={() => setMuted(!muted)}>
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

/** True for `ms` after `trigger` changes to a truthy value. */
export function usePulse(trigger: unknown, ms: number): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!trigger) return;
    setOn(true);
    const id = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(id);
  }, [trigger, ms]);
  return on;
}
