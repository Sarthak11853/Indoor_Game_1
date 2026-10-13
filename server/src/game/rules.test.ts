import { describe, expect, it } from 'vitest';
import { possessedCount } from './rules';

describe('possessedCount', () => {
  it('gives one Possessed per 4 players, minimum 1', () => {
    expect(possessedCount(4)).toBe(1);
    expect(possessedCount(7)).toBe(1);
    expect(possessedCount(8)).toBe(2);
    expect(possessedCount(12)).toBe(3);
    expect(possessedCount(2)).toBe(1);
  });
});
