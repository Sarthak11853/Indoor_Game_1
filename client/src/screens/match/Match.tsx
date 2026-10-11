import type { Phase } from '@hv/shared';
import { mmss, secondsLeft, useServerNow } from '../../clock';
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
import { DevPanel, devMode } from './DevPanel';

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

export function Match({ view }: PhaseProps) {
  const { phase } = view.public;
  const Screen = { reveal: Reveal, night: Night, morning: Morning, day: Day, vote: Vote, result: Result, gameOver: GameOver }[
    phase as Exclude<Phase, 'lobby'>
  ];

  return (
    <main className={`screen phase-${phase} ${view.me.alive || phase === 'gameOver' ? '' : 'spirit'}`}>
      <MatchHeader view={view} title={TITLES[phase]} />
      {!view.me.alive && phase !== 'gameOver' && (
        <p className="spirit-note">You are a Spirit. You cannot vote, but each night you can haunt the living.</p>
      )}
      <Screen view={view} />
      {phase !== 'reveal' && phase !== 'gameOver' && <Inbox view={view} />}
      {devMode && <DevPanel view={view} />}
      <Alarms view={view} />
    </main>
  );
}

function MatchHeader({ view, title }: PhaseProps & { title: string }) {
  const now = useServerNow();
  const { phaseEndsAt, midnightAt, round, phase } = view.public;
  const toMidnight = secondsLeft(midnightAt, now);

  return (
    <header className="match-header">
      <div>
        <p className="phase-title">{title}</p>
        {round > 0 && <p className="muted small">Round {round}</p>}
      </div>
      {phaseEndsAt !== null && <p className="phase-timer">{mmss(secondsLeft(phaseEndsAt, now))}</p>}
      {midnightAt !== null && phase !== 'gameOver' && (
        <p className={`midnight ${toMidnight <= 60 ? 'final' : ''}`} title="Midnight clock">
          🕛 {mmss(toMidnight)}
        </p>
      )}
    </header>
  );
}
