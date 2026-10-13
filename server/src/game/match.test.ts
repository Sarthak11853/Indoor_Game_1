import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, PHASE_SECONDS } from '@hv/shared';
import { harness, seeded } from './testkit';
import { RuleError, type Action } from './types';
import { viewFor } from './view';

describe('starting a match', () => {
  it('needs the host and at least 4 players', () => {
    expect(() => harness(3).act({ type: 'start', by: 'p0' })).toThrow(/at least 4/);
    expect(() => harness(4).act({ type: 'start', by: 'p1' })).toThrow(/host/);
  });

  it('deals one Possessed per 4 players and opens the reveal', () => {
    const h = harness(8);
    h.act({ type: 'start', by: 'p0' });
    expect(h.state.phase).toBe('reveal');
    expect(h.state.players.filter((p) => p.role === 'possessed')).toHaveLength(2);
    expect(h.state.phaseEndsAt).toBe(h.now() + PHASE_SECONDS.reveal * 1000);
  });

  it('starts night 1 and the midnight clock once everyone has seen their role', () => {
    const h = harness(4);
    h.toNight(['p3']);
    expect(h.state).toMatchObject({ phase: 'night', round: 1 });
    expect(h.state.midnightAt).toBe(h.now() + DEFAULT_SETTINGS.midnightSeconds * 1000);
  });

  it('starts night 1 anyway when the reveal timer runs out', () => {
    const h = harness(4);
    h.act({ type: 'start', by: 'p0' });
    h.wait(PHASE_SECONDS.reveal - 1);
    expect(h.state.phase).toBe('reveal');
    h.wait(1);
    expect(h.state.phase).toBe('night');
  });
});

describe('night', () => {
  it('requires a charm tap before picking, and forbids picking yourself or a partner', () => {
    const h = harness(8);
    h.toNight(['p0', 'p1']);
    expect(() => h.act({ type: 'pick', playerId: 'p2', targetId: 'p3' })).toThrow(/charm/);
    h.act({ type: 'charm', playerId: 'p0', source: 'button' });
    expect(() => h.act({ type: 'pick', playerId: 'p0', targetId: 'p0' })).toThrow(/yourself/);
    expect(() => h.act({ type: 'pick', playerId: 'p0', targetId: 'p1' })).toThrow(/one of you/);
  });

  it('rejects the on-screen charm button in a cards-only match', () => {
    const h = harness(4);
    h.act({ type: 'settings', by: 'p0', settings: { allowTapButton: false } });
    ['p0', 'p1', 'p2', 'p3'].forEach((id) => h.act({ type: 'cardTap', playerId: id, cardId: `charm-${id}` }));
    h.toNight(['p3']);
    expect(() => h.act({ type: 'charm', playerId: 'p1', source: 'button' })).toThrow(/cards only/);
    h.act({ type: 'charm', playerId: 'p1', source: 'card' });
    expect(h.state.ready).toContain('p1');
  });

  it('takes the Possessed target when nobody protects them', () => {
    const h = harness(4);
    h.toNight(['p3']);
    h.night('p3', 'p1');
    h.wait(DEFAULT_SETTINGS.nightSeconds);
    expect(h.state.phase).toBe('morning');
    expect(h.state.lastNight).toEqual({ takenId: 'p1', saved: false });
    expect(h.alive()).toEqual(['p0', 'p2', 'p3']);
  });

  it('saves the target with 1 protector when 5 or fewer are alive', () => {
    const h = harness(5);
    h.toNight(['p4']);
    h.night('p4', 'p1');
    h.night('p0', 'p1');
    h.wait(DEFAULT_SETTINGS.nightSeconds);
    expect(h.state.lastNight).toEqual({ takenId: null, saved: true });
    expect(h.alive()).toHaveLength(5);
  });

  it('needs 2 protectors when 6 or more are alive', () => {
    const one = harness(6);
    one.toNight(['p5']);
    one.night('p5', 'p1');
    one.night('p0', 'p1');
    one.wait(DEFAULT_SETTINGS.nightSeconds);
    expect(one.state.lastNight?.takenId).toBe('p1');

    const two = harness(6);
    two.toNight(['p5']);
    two.night('p5', 'p1');
    two.night('p0', 'p1');
    two.night('p2', 'p1');
    two.wait(DEFAULT_SETTINGS.nightSeconds);
    expect(two.state.lastNight).toEqual({ takenId: null, saved: true });
  });

  it('protects nobody when the Possessed pick nobody', () => {
    const h = harness(4);
    h.toNight(['p3']);
    h.wait(DEFAULT_SETTINGS.nightSeconds);
    expect(h.state.lastNight).toEqual({ takenId: null, saved: false });
  });

  it('ends early once every living player has acted', () => {
    const h = harness(4);
    h.toNight(['p3']);
    h.night('p3', 'p1');
    h.night('p0', 'p2');
    h.night('p1', 'p2');
    expect(h.state.phase).toBe('night');
    h.night('p2', 'p0');
    expect(h.state.phase).toBe('morning');
  });
});

describe('day and vote', () => {
  function toVote() {
    const h = harness(5);
    h.toNight(['p4']);
    h.wait(DEFAULT_SETTINGS.nightSeconds); // nobody taken
    h.wait(PHASE_SECONDS.morning);
    expect(h.state.phase).toBe('day');
    h.act({ type: 'skipDay', by: 'p0' });
    expect(h.state.phase).toBe('vote');
    return h;
  }

  it('only lets the host skip the day', () => {
    const h = harness(4);
    h.toNight(['p3']);
    h.wait(DEFAULT_SETTINGS.nightSeconds);
    h.wait(PHASE_SECONDS.morning);
    expect(() => h.act({ type: 'skipDay', by: 'p1' })).toThrow(/host/);
    h.wait(DEFAULT_SETTINGS.daySeconds);
    expect(h.state.phase).toBe('vote');
  });

  it('eliminates the single most-voted player and reveals them', () => {
    const h = toVote();
    h.act({ type: 'pick', playerId: 'p0', targetId: 'p1' });
    h.act({ type: 'pick', playerId: 'p2', targetId: 'p1' });
    h.act({ type: 'pick', playerId: 'p1', targetId: 'p2' });
    h.wait(PHASE_SECONDS.vote);
    expect(h.state.phase).toBe('result');
    expect(h.state.lastVote).toEqual({ eliminatedId: 'p1', tally: { p1: 2, p2: 1 } });
    expect(viewFor(h.state, 'p0', 0).public.players[1].role).toBe('villager');
  });

  it('eliminates nobody on a tie or with no votes', () => {
    const tie = toVote();
    tie.act({ type: 'pick', playerId: 'p0', targetId: 'p1' });
    tie.act({ type: 'pick', playerId: 'p1', targetId: 'p0' });
    tie.wait(PHASE_SECONDS.vote);
    expect(tie.state.lastVote?.eliminatedId).toBeNull();

    const none = toVote();
    none.wait(PHASE_SECONDS.vote);
    expect(none.state.lastVote).toEqual({ eliminatedId: null, tally: {} });
  });

  it('lets players change their vote until the phase ends, and Spirits cannot vote', () => {
    const h = harness(4);
    h.toNight(['p3']);
    h.night('p3', 'p1');
    h.wait(DEFAULT_SETTINGS.nightSeconds);
    h.wait(PHASE_SECONDS.morning);
    h.act({ type: 'skipDay', by: 'p0' });
    expect(() => h.act({ type: 'pick', playerId: 'p1', targetId: 'p3' })).toThrow(/Spirits/);
    expect(() => h.act({ type: 'pick', playerId: 'p0', targetId: 'p1' })).toThrow(/living/);
    h.act({ type: 'pick', playerId: 'p0', targetId: 'p2' });
    h.act({ type: 'pick', playerId: 'p0', targetId: 'p3' });
    expect(h.state.picks.p0).toBe('p3');
  });

  it('goes on to the next night when nobody has won', () => {
    const h = toVote();
    h.wait(PHASE_SECONDS.vote);
    h.wait(PHASE_SECONDS.result);
    expect(h.state).toMatchObject({ phase: 'night', round: 2, picks: {}, ready: [] });
  });
});

describe('winning', () => {
  it('Villagers win when the last Possessed is voted out', () => {
    const h = harness(4);
    h.toNight(['p3']);
    h.wait(DEFAULT_SETTINGS.nightSeconds);
    h.wait(PHASE_SECONDS.morning);
    h.act({ type: 'skipDay', by: 'p0' });
    for (const id of ['p0', 'p1', 'p2']) h.act({ type: 'pick', playerId: id, targetId: 'p3' });
    h.act({ type: 'pick', playerId: 'p3', targetId: 'p0' }); // everyone voted: ends early
    expect(h.state.phase).toBe('result');
    h.wait(PHASE_SECONDS.result);
    expect(h.state).toMatchObject({ phase: 'gameOver', winner: 'villager', winReason: 'possessedGone' });
  });

  it('Possessed win when they equal the Villagers', () => {
    const h = harness(4);
    h.toNight(['p3']);
    h.night('p3', 'p1');
    h.wait(DEFAULT_SETTINGS.nightSeconds);
    h.wait(PHASE_SECONDS.morning);
    h.act({ type: 'skipDay', by: 'p0' });
    h.act({ type: 'pick', playerId: 'p3', targetId: 'p0' });
    h.act({ type: 'pick', playerId: 'p2', targetId: 'p0' });
    h.wait(PHASE_SECONDS.vote);
    h.wait(PHASE_SECONDS.result);
    expect(h.state).toMatchObject({ phase: 'gameOver', winner: 'possessed', winReason: 'outnumbered' });
  });

  it('Possessed win when the midnight clock strikes, whatever the phase', () => {
    const h = harness(4);
    h.act({ type: 'settings', by: 'p0', settings: { midnightSeconds: 300 } });
    h.toNight(['p3']);
    h.wait(299);
    expect(h.state.phase).not.toBe('gameOver');
    h.wait(1);
    expect(h.state).toMatchObject({ phase: 'gameOver', winner: 'possessed', winReason: 'midnight' });
  });

  it('play again returns everyone to the lobby with roles cleared', () => {
    const h = harness(4);
    h.act({ type: 'settings', by: 'p0', settings: { midnightSeconds: 300 } });
    h.toNight(['p3']);
    h.wait(300);
    expect(() => h.act({ type: 'playAgain', by: 'p1' })).toThrow(/host/);
    h.act({ type: 'playAgain', by: 'p0' });
    expect(h.state).toMatchObject({ phase: 'lobby', round: 0, midnightAt: null, winner: null });
    expect(h.state.players.every((p) => p.alive && p.role === null)).toBe(true);
    expect(h.state.settings.midnightSeconds).toBe(300);
  });
});

describe('privacy', () => {
  it('shows a Villager only their own role', () => {
    const h = harness(8);
    h.toNight(['p0', 'p1']);
    const v = viewFor(h.state, 'p2', 0);
    expect(v.me).toMatchObject({ role: 'villager', partners: [], partnerPicks: {} });
    expect(v.public.players.every((p) => p.role === undefined)).toBe(true);
    expect(JSON.stringify(v)).not.toContain('possessed');
  });

  it('shows the Possessed their partners and partners’ night picks, but nobody else’s', () => {
    const h = harness(8);
    h.toNight(['p0', 'p1']);
    h.night('p1', 'p5');
    h.night('p2', 'p6');
    const v = viewFor(h.state, 'p0', 0);
    expect(v.me).toMatchObject({ role: 'possessed', partners: ['p1'], partnerPicks: { p1: 'p5' } });
    expect(JSON.stringify(v.me)).not.toContain('p6');
  });

  it('never shows another player’s pick to a Villager', () => {
    const h = harness(4);
    h.toNight(['p3']);
    h.night('p3', 'p1');
    expect(JSON.stringify(viewFor(h.state, 'p0', 0).me)).not.toContain('p1');
  });

  it('reveals every role at game over', () => {
    const h = harness(4);
    h.act({ type: 'settings', by: 'p0', settings: { midnightSeconds: 300 } });
    h.toNight(['p3']);
    h.wait(300);
    expect(viewFor(h.state, 'p0', 0).public.players.map((p) => p.role)).toEqual([
      'villager',
      'villager',
      'villager',
      'possessed',
    ]);
  });
});

describe('random full games', () => {
  it('always reach game over without breaking a rule', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seeded(seed);
      const h = harness(4 + (seed % 9), seed);
      h.act({ type: 'start', by: 'p0' });
      const possessed = h.state.players.filter((p) => p.role === 'possessed').length;
      expect(possessed).toBe(Math.max(1, Math.floor(h.state.players.length / 4)));

      for (let step = 0; step < 5000 && h.state.phase !== 'gameOver'; step++) {
        const alive = h.state.players.filter((p) => p.alive);
        const actor = alive[Math.floor(rng() * alive.length)];
        const target = alive[Math.floor(rng() * alive.length)];
        const moves: Action[] = [
          { type: 'ready', playerId: actor.id },
          { type: 'charm', playerId: actor.id, source: 'button' },
          { type: 'pick', playerId: actor.id, targetId: target.id },
          { type: 'skipDay', by: 'p0' },
        ];
        try {
          h.act(moves[Math.floor(rng() * moves.length)]);
        } catch (err) {
          expect(err).toBeInstanceOf(RuleError);
        }
        if (rng() < 0.1) h.wait(15);

        const living = h.state.players.filter((p) => p.alive);
        const livingPossessed = living.filter((p) => p.role === 'possessed').length;
        if (h.state.phase === 'night' || h.state.phase === 'day' || h.state.phase === 'vote') {
          expect(livingPossessed).toBeGreaterThan(0);
          expect(livingPossessed).toBeLessThan(living.length - livingPossessed);
        }
      }
      expect(h.state.phase).toBe('gameOver');
    }
  });
});
