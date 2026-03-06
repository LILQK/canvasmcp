import { describe, expect, it } from 'vitest';
import { isDateWithinRange, normalizeDateTime } from '../src/canvas/date.js';

describe('date normalization', () => {
  it('normalizes ISO values to Europe/Madrid while preserving the raw value', () => {
    const value = normalizeDateTime('2026-03-06T12:00:00Z');

    expect(value.raw).toBe('2026-03-06T12:00:00Z');
    expect(value.localDateTime).toBe('2026-03-06T13:00:00');
  });

  it('checks whether a date falls inside a range', () => {
    expect(isDateWithinRange('2026-03-10T12:00:00Z', '2026-03-09T00:00:00Z', '2026-03-11T00:00:00Z')).toBe(true);
    expect(isDateWithinRange('2026-03-12T12:00:00Z', '2026-03-09T00:00:00Z', '2026-03-11T00:00:00Z')).toBe(false);
  });
});
