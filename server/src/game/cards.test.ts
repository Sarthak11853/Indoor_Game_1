import { describe, expect, it } from 'vitest';
import { cardUrl, parseCardId, randomCardId } from '@hv/shared';
import { VILLAGE } from '../alarms/alarms.config';
import { cardMeaning } from './machine';
import { harness } from './testkit';
import { viewFor } from './view';

describe('card ids and urls', () => {
  it('round-trips a card id through its URL', () => {
    const id = randomCardId();
    expect(id).toMatch(/^[a-z0-9]{10}$/);
    expect(parseCardId(cardUrl('https://village.example/', id))).toBe(id);
    expect(parseCardId(id)).toBe(id);
    expect(parseCardId('https://village.example/tap')).toBeNull();
    expect(parseCardId('no spaces allowed')).toBeNull();
  });
});

describe('linking charms in the lobby', () => {
  it('links an unclaimed card to the tapping player, one charm each', () => {
    const h = harness(4);
    h.act({ type: 'cardTap', playerId: 'p1', cardId: 'card-one' });
    expect(h.state.charms).toEqual({ 'card-one': 'p1' });
    expect(cardMeaning(h.state, 'p1', 'card-one')).toBe('alreadyLinked');
    // Linking another card releases the first.
    h.act({ type: 'cardTap', playerId: 'p1', cardId: 'card-two' });
    expect(h.state.charms).toEqual({ 'card-two': 'p1' });
  });

  it('refuses a card someone else has linked, and malformed ids', () => {
    const h = harness(4);
    h.act({ type: 'cardTap', playerId: 'p1', cardId: 'card-one' });
    expect(() => h.act({ type: 'cardTap', playerId: 'p2', cardId: 'card-one' })).toThrow(/belongs to P1/);
    expect(() => h.act({ type: 'cardTap', playerId: 'p2', cardId: 'bad id!' })).toThrow(/not a Haunted Village card/);
  });

  it('shows who has a charm, but only tells each player their own card id', () => {
    const h = harness(4);
    h.act({ type: 'cardTap', playerId: 'p1', cardId: 'card-one' });
    const v = viewFor(h.state, 'p2', 0);
    expect(v.public.players.map((p) => p.hasCharm)).toEqual([false, true, false, false]);
    expect(v.me.charmId).toBeNull();
    expect(JSON.stringify(v)).not.toContain('card-one');
    expect(viewFor(h.state, 'p1', 0).me.charmId).toBe('card-one');
  });

  it('frees the charm of a player who leaves', () => {
    const h = harness(4);
    h.act({ type: 'cardTap', playerId: 'p1', cardId: 'card-one' });
    h.act({ type: 'leave', playerId: 'p1' });
    expect(h.state.charms).toEqual({});
  });

  it('requires every player to link a charm before a cards-only match', () => {
    const h = harness(4);
    h.act({ type: 'settings', by: 'p0', settings: { allowTapButton: false } });
    expect(() => h.act({ type: 'start', by: 'p0' })).toThrow(/link a charm/);
    ['p0', 'p1', 'p2', 'p3'].forEach((id, i) => h.act({ type: 'cardTap', playerId: id, cardId: `charm-${i}` }));
    h.act({ type: 'start', by: 'p0' });
    expect(h.state.phase).toBe('reveal');
  });
});

describe('cards during a match', () => {
  function cardsMatch() {
    const h = harness(5);
    ['p0', 'p1', 'p2', 'p3', 'p4'].forEach((id, i) => h.act({ type: 'cardTap', playerId: id, cardId: `charm-${i}` }));
    h.act({ type: 'settings', by: 'p0', settings: { allowTapButton: false } });
    return h;
  }

  it('your own charm works at night even when the on-screen button is off', () => {
    const h = cardsMatch();
    h.act({ type: 'start', by: 'p0' });
    h.roles(['p4']);
    h.state.players.forEach((p) => h.act({ type: 'ready', playerId: p.id }));
    h.act({ type: 'cardTap', playerId: 'p1', cardId: 'charm-1' });
    expect(h.state.ready).toContain('p1');
    expect(() => h.act({ type: 'cardTap', playerId: 'p1', cardId: 'charm-2' })).toThrow(/someone else/);
  });

  it('your charm answers a danger alarm', () => {
    const h = cardsMatch();
    h.toDay(['p4']);
    h.addAlarm({ kind: 'danger', targetId: 'p2', text: 'tap!', endsAt: h.now() + 5000 });
    h.act({ type: 'cardTap', playerId: 'p2', cardId: 'charm-2' });
    expect(h.state.alarms).toEqual([]);
  });

  it('unclaimed cards are relics: dormant until a relic race, then usable once', () => {
    const h = cardsMatch();
    h.toDay(['p4']);
    expect(cardMeaning(h.state, 'p1', 'relic-x')).toBe('relic');
    expect(() => h.act({ type: 'cardTap', playerId: 'p1', cardId: 'relic-x' })).toThrow(/dormant/);
    h.addAlarm({ kind: 'relicRace', targetId: null, text: VILLAGE.relicRace.text, endsAt: h.now() + 30_000 });
    h.act({ type: 'cardTap', playerId: 'p1', cardId: 'relic-x' });
    expect(h.state.relicRewards).toEqual(['p1']);
    expect(h.state.usedRelics).toEqual(['relic-x']);
  });

  it('keeps linked charms for the next match', () => {
    const h = cardsMatch();
    h.act({ type: 'settings', by: 'p0', settings: { midnightSeconds: 300 } });
    h.toNight(['p4']);
    h.wait(300);
    h.act({ type: 'playAgain', by: 'p0' });
    expect(Object.keys(h.state.charms)).toHaveLength(5);
  });
});
