import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Phase } from '@hv/shared';
import { mmss, secondsLeft, useServerNow } from '../../clock';
import { NightSky } from '../../fx/Effects';
import { sfx } from '../../fx/sound';
import type { PhaseProps } from './common';
import { Reveal } from './Reveal';
import { Night } from './Night';
import { Morning } from './Morning';
import { Day } from './Day';
import { Vote } from './Vote';
import { Result } from './Result';
import { GameOver } from './GameOver';
import { Alarms } from './Alarms';
import { Inbox } from './Inbox';
import { DevPanel, devMode } from '../DevPanel';
import { NfcButton } from '../../nfc/NfcControls';

const TITLES: Record<Phase, string> = {
  lobby: 'Lobby',
  reveal: 'Your role',
  night: 'Night',
  morning: 'Morning',
  day: 'Day',
  vote: 'Vote',
  result: 'The verdict',
  gameOver: 'Game over',
};

const PHASE_SOUNDS: Partial<Record<Phase, () => void>> = {
  night: sfx.night,
  morning: sfx.chime,
  vote: sfx.tap,
};

export function Match({ view }: PhaseProps) {
  const { phase } = view.public;
  const Screen = { reveal: Reveal, night: Night, morning: Morning, day: Day, vote: Vote, result: Result, gameOver: GameOver }[
    phase as Exclude<Phase, 'lobby'>
  ];
  const spirit = !view.me.alive && phase !== 'gameOver';
  const becameSpirit = useBecameSpirit(view.me.alive);

  useEffect(() => PHASE_SOUNDS[phase]?.(), [phase]);

  return (
    <main className={`screen phase-${phase} ${spirit ? 'spirit' : ''}`}>
      {phase === 'night' && <NightSky />}
      <MatchHeader view={view} title={TITLES[phase]} />
      {spirit && (
        <p className="spirit-note">You are a Spirit. You cannot vote, but each night you can haunt the living.</p>
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          className="phase-body"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35 }}
        >
          <Screen view={view} />
        </motion.div>
      </AnimatePresence>
      {phase !== 'reveal' && phase !== 'gameOver' && <Inbox view={view} />}
      {devMode && <DevPanel view={view} />}
      <Alarms view={view} />
      <AnimatePresence>
        {becameSpirit && (
          <motion.div
            className="overlay spirit-moment"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <p className="ghost-float" aria-hidden>
              👻
            </p>
            <p className="lead">You have become a Spirit.</p>
            <p className="muted small">You cannot vote, but you can still whisper to the living.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/** True for a few seconds right after this player dies. */
function useBecameSpirit(alive: boolean): boolean {
  const wasAlive = useRef(alive);
  const [showing, setShowing] = useState(false);
  useEffect(() => {
    if (wasAlive.current && !alive) {
      setShowing(true);
      sfx.toll();
      const id = setTimeout(() => setShowing(false), 3500);
      wasAlive.current = alive;
      return () => clearTimeout(id);
    }
    wasAlive.current = alive;
  }, [alive]);
  return showing;
}

function MatchHeader({ view, title }: PhaseProps & { title: string }) {
  const now = useServerNow();
  const { phaseEndsAt, midnightAt, round, phase } = view.public;
  const toMidnight = secondsLeft(midnightAt, now);
  const finalMinute = midnightAt !== null && toMidnight <= 60;

  // Toll once as the final minute begins.
  const tolled = useRef(false);
  useEffect(() => {
    if (finalMinute && !tolled.current && phase !== 'gameOver') sfx.toll();
    tolled.current = finalMinute;
  }, [finalMinute, phase]);

  return (
    <header className="match-header">
      <div>
        <p className="phase-title">{title}</p>
        {round > 0 && <p className="muted small">Round {round}</p>}
      </div>
      <NfcButton compact />
      {phaseEndsAt !== null && <p className="phase-timer">{mmss(secondsLeft(phaseEndsAt, now))}</p>}
      {midnightAt !== null && phase !== 'gameOver' && (
        <p className={`midnight ${finalMinute ? 'final' : ''}`} title="Midnight clock">
          🕛 {mmss(toMidnight)}
        </p>
      )}
    </header>
  );
}
