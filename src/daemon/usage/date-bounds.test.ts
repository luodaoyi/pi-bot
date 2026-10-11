import { describe, expect, it } from 'vitest';
import { boundEndDate, boundStartDate } from './date-bounds.js';

describe('usage date bounds', () => {
  it('expands YYYY-MM-DD so same-day ISO timestamps stay in range', () => {
    expect(boundStartDate('2026-10-11')).toBe('2026-10-11T00:00:00.000Z');
    expect(boundEndDate('2026-10-11')).toBe('2026-10-11T23:59:59.999Z');
    const ts = '2026-10-11T16:19:38.517Z';
    expect(ts >= boundStartDate('2026-10-11')).toBe(true);
    expect(ts <= boundEndDate('2026-10-11')).toBe(true);
    expect(ts <= '2026-10-11').toBe(false);
  });

  it('leaves full ISO strings unchanged', () => {
    const start = '2026-10-10T12:00:00.000Z';
    const end = '2026-10-12T12:00:00.000Z';
    expect(boundStartDate(start)).toBe(start);
    expect(boundEndDate(end)).toBe(end);
  });
});
