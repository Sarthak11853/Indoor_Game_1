import type { PhaseProps } from './common';

const ICONS = { clue: '👁', spirit: '👻', relic: '🔮', alarm: '⏰' } as const;

/** The player's private messages: clues, spirit hints and alarm outcomes. Newest first. */
export function Inbox({ view }: PhaseProps) {
  const items = [...view.me.inbox].reverse();
  if (!items.length) return null;
  return (
    <details className="inbox" open>
      <summary>Your secrets ({items.length})</summary>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <span aria-hidden>{ICONS[item.source]}</span> {item.text}
          </li>
        ))}
      </ul>
    </details>
  );
}
