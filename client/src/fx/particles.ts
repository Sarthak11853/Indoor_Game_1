// A one-shot particle burst on a temporary full-screen canvas.
// Skipped entirely for reduced motion; fewer particles on slower phones.
import { lowEndDevice, prefersReducedMotion } from './motion';

interface BurstOptions {
  colors: string[];
  count?: number;
  /** Centre of the burst as fractions of the screen (default: middle). */
  x?: number;
  y?: number;
  /** How far particles fly, in px per second at the start. */
  speed?: number;
  duration?: number;
}

export function burst({ colors, count = 90, x = 0.5, y = 0.5, speed = 520, duration = 1400 }: BurstOptions) {
  if (prefersReducedMotion()) return;
  const n = lowEndDevice() ? Math.round(count / 2) : count;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');
  if (!g) return canvas.remove();
  g.scale(dpr, dpr);

  const cx = innerWidth * x;
  const cy = innerHeight * y;
  const parts = Array.from({ length: n }, () => {
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    return {
      x: cx,
      y: cy,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      size: 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  });

  const start = performance.now();
  let last = start;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const life = (now - start) / duration;
    if (life >= 1) return canvas.remove();
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.globalAlpha = 1 - life;
    for (const p of parts) {
      p.vy += 600 * dt; // gravity
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      g.fillStyle = p.color;
      g.fillRect(p.x, p.y, p.size, p.size);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
