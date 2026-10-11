// ─────────────────────────────────────────────────────────────────────────────
// All surprise-alarm text and timing lives in this one file.
// Add, remove or reword entries freely; the engine picks from these lists.
// Placeholders in {braces} are filled in by the engine.
// ─────────────────────────────────────────────────────────────────────────────
import { MAX_HINT_LENGTH } from '@hv/shared';

export const ALARM_TIMING = {
  /** Gap between alarms at the start of the match, in seconds… */
  earlySeconds: 120,
  /** …shrinking towards this as the midnight clock runs down. */
  lateSeconds: 50,
  /** Random spread around the gap: 0.2 means ±20% (late game: 40–60s). */
  jitter: 0.2,
  /** The first alarm of each day comes sooner: this fraction of the gap (min, max). */
  firstOfDay: [0.3, 0.7] as const,
  /** Never start an alarm with fewer than this many seconds of day left after it. */
  marginSeconds: 5,
};

/** How often each kind is chosen, relative to each other. */
export const ALARM_WEIGHTS = {
  danger: 3,
  mission: 3,
  whisper: 2,
  village: 2,
};

export const DANGER = {
  seconds: 5,
  texts: ['Tap your charm in 5 seconds!', 'Something is behind you. Tap your charm, quick!', 'Cold hands on your neck. Tap your charm now!'],
  saved: 'Your charm flared in time. You are safe.',
  missed: 'Too slow. The darkness took your voice: you lose your vote this round.',
};

/**
 * Missions come in pairs: Villagers get `villager`, Possessed get `possessed`.
 * Both look the same on screen, so receiving one reveals nothing.
 * Success is self-reported and earns an extra vote this round.
 */
export const MISSIONS = [
  {
    seconds: 60,
    villager: "Get someone to say the word 'ghost' within 60 seconds.",
    possessed: 'Make someone accuse an innocent player within 60 seconds.',
  },
  {
    seconds: 60,
    villager: 'Get two players to agree with you out loud within 60 seconds.',
    possessed: 'Get someone to defend you without asking them to, within 60 seconds.',
  },
  {
    seconds: 45,
    villager: "Make someone laugh within 45 seconds.",
    possessed: 'Change the subject away from yourself within 45 seconds without anyone noticing.',
  },
  {
    seconds: 60,
    villager: 'Get someone to point at another player within 60 seconds.',
    possessed: 'Get someone to say they trust you within 60 seconds.',
  },
];

export const MISSION_OUTCOMES = {
  done: 'Mission complete. You have an extra vote this round.',
};

/** Whisper clues are always true. {a}, {b} are player names, {n} a number. */
export const WHISPERS = {
  seconds: 12,
  neighboursSome: 'At least one of your neighbours, {a} and {b}, is Possessed.',
  neighboursNone: 'Neither of your neighbours, {a} nor {b}, is Possessed.',
  pair: 'At least one of {a} and {b} is Possessed.',
  innocent: '{a} is not Possessed.',
  distance: 'The nearest Possessed sits {n} seats away from you.',
};

export const VILLAGE = {
  blackout: { seconds: 20, text: 'Blackout! Nobody may speak for 20 seconds.' },
  swapSeats: { seconds: 30, text: 'Everyone swap seats! Your phone shows where to sit.' },
  relicRace: {
    seconds: 30,
    text: 'Relic race! The first to tap any relic card wins a bonus.',
    maxPerMatch: 3,
  },
};

export const RELIC_OUTCOMES = {
  won: 'You won the relic race! Choose your reward.',
  vote: 'The relic hums. You have an extra vote this round.',
  peek: 'The relic shows you the truth: {a} is {role}.',
};

export const SPIRITS = {
  maxHintLength: MAX_HINT_LENGTH,
  hint: 'A spirit whispers: "{text}"',
};
