import { describe, expect, it } from 'vitest';
import { extractDeadlineSignal } from '../src/canvas/signals.js';

describe('deadline signals', () => {
  it('detects hidden delivery vocabulary', () => {
    const signal = extractDeadlineSignal('Hay una subentrega de seguimiento y una parte 1 antes del viernes.');

    expect(signal.score).toBeGreaterThanOrEqual(2);
    expect(signal.matches).toContain('subentrega');
    expect(signal.matches).toContain('seguimiento');
  });

  it('returns no matches for neutral text', () => {
    expect(extractDeadlineSignal('Mensaje general del curso')).toEqual({
      score: 0,
      matches: []
    });
  });
});
