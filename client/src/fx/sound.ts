// Short sound effects, synthesised with the Web Audio API (no audio files).
// Browsers only allow audio after a user gesture, so the context is created
// on the first tap anywhere. Muting is remembered on this phone.
import { useSyncExternalStore } from 'react';
import { load, save } from '../storage';

let ctx: AudioContext | null = null;
let muted = load<boolean>('muted') ?? false;
const listeners = new Set<() => void>();

export function unlockAudio() {
  if (ctx) return;
  try {
    ctx = new AudioContext();
  } catch {
    ctx = null;
  }
}

export function setMuted(value: boolean) {
  muted = value;
  save('muted', value);
  listeners.forEach((l) => l());
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => muted,
  );
}

/** Runs a sound only when audio is unlocked and not muted. */
function play(build: (ac: AudioContext, out: GainNode, t: number) => void, volume = 0.5) {
  if (muted || !ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const out = ctx.createGain();
  out.gain.value = volume;
  out.connect(ctx.destination);
  build(ctx, out, ctx.currentTime);
}

/** One oscillator note with a quick attack and exponential release. */
function tone(ac: AudioContext, out: AudioNode, t: number, freq: number, dur: number, type: OscillatorType = 'sine', peak = 0.6) {
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  return osc;
}

/** A burst of filtered white noise. */
function noise(ac: AudioContext, out: AudioNode, t: number, dur: number, filter: BiquadFilterType, freq: number, peak = 0.6) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const bq = ac.createBiquadFilter();
  bq.type = filter;
  bq.frequency.value = freq;
  const env = ac.createGain();
  env.gain.setValueAtTime(peak, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bq).connect(env).connect(out);
  src.start(t);
}

export const sfx = {
  tap: () => play((ac, out, t) => tone(ac, out, t, 660, 0.08, 'triangle', 0.4), 0.3),

  /** Role card flips: a warm chord for Villagers, a low dissonant drone for the Possessed. */
  reveal: (possessed: boolean) =>
    play((ac, out, t) => {
      const notes = possessed ? [65.4, 69.3, 98] : [261.6, 329.6, 392];
      notes.forEach((f, i) => tone(ac, out, t + i * 0.04, f, possessed ? 2.2 : 1.6, possessed ? 'sawtooth' : 'sine', possessed ? 0.25 : 0.35));
    }),

  /** Night falls: a soft descending wind. */
  night: () =>
    play((ac, out, t) => {
      noise(ac, out, t, 2.5, 'lowpass', 500, 0.35);
      const osc = tone(ac, out, t, 220, 2.2, 'sine', 0.15);
      osc.frequency.exponentialRampToValueAtTime(110, t + 2.2);
    }),

  /** Morning bell. */
  chime: () =>
    play((ac, out, t) => {
      [523.3, 784, 1046.5].forEach((f, i) => tone(ac, out, t + i * 0.12, f, 2.4, 'sine', 0.3));
    }),

  /** Danger: harsh repeated alarm beeps. */
  danger: () =>
    play((ac, out, t) => {
      for (let i = 0; i < 3; i++) tone(ac, out, t + i * 0.18, 880, 0.12, 'square', 0.35);
    }, 0.4),

  /** Gentle ping for missions and whispers. */
  ping: () =>
    play((ac, out, t) => {
      tone(ac, out, t, 988, 0.4, 'sine', 0.4);
      tone(ac, out, t + 0.1, 1318.5, 0.6, 'sine', 0.3);
    }),

  /** Relic race: a bright rising shimmer. */
  relic: () =>
    play((ac, out, t) => {
      [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => tone(ac, out, t + i * 0.07, f, 0.8, 'triangle', 0.3));
    }),

  /** Drumroll for the vote reveal. */
  drumroll: (seconds: number) =>
    play((ac, out, t) => {
      for (let s = 0; s < seconds; s += 0.06) noise(ac, out, t + s, 0.05, 'bandpass', 180, 0.25 + (0.35 * s) / seconds);
    }),

  /** Glass-like shatter. */
  shatter: () =>
    play((ac, out, t) => {
      noise(ac, out, t, 0.9, 'highpass', 2500, 0.8);
      [1760, 2349, 3136].forEach((f, i) => tone(ac, out, t + i * 0.03, f, 0.5, 'triangle', 0.2));
    }),

  /** Midnight is near: a deep bell toll. */
  toll: () =>
    play((ac, out, t) => {
      tone(ac, out, t, 110, 3, 'sine', 0.5);
      tone(ac, out, t, 220.5, 2.5, 'sine', 0.2);
    }),

  win: () =>
    play((ac, out, t) => {
      [392, 523.3, 659.3, 784].forEach((f, i) => tone(ac, out, t + i * 0.15, f, 1.2, 'triangle', 0.35));
    }),

  lose: () =>
    play((ac, out, t) => {
      [392, 349.2, 311.1, 233.1].forEach((f, i) => tone(ac, out, t + i * 0.22, f, 1.2, 'sine', 0.3));
    }),
};
