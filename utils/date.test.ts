import { describe, it, expect } from 'vitest';
import { formatDate, formatRepaymentDate, calculateRemainingDays } from './date';

describe('formatDate', () => {
  it('formats date string to zh-CN locale with month/day and 2-digit time', () => {
    const result = formatDate('2026-04-15T14:30:00');
    expect(result).toContain('4');
    expect(result).toContain('15');
    expect(result).toContain('14');
    expect(result).toContain('30');
  });
});

describe('formatRepaymentDate', () => {
  it('returns MM-DD format when year matches current year', () => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const dateStr = `${thisYear}-06-15`;
    const result = formatRepaymentDate(dateStr);
    expect(result).toBe('06-15');
  });

  it('returns YYYY-MM-DD format when year differs', () => {
    const dateStr = '2025-12-01';
    const result = formatRepaymentDate(dateStr);
    expect(result).toBe('2025-12-01');
  });
});

describe('calculateRemainingDays', () => {
  it('returns positive days for future date', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const days = calculateRemainingDays(futureDate.toISOString());
    expect(days).toBeGreaterThanOrEqual(4);
    expect(days).toBeLessThanOrEqual(6);
  });

  it('returns negative days for past date', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const days = calculateRemainingDays(pastDate.toISOString());
    expect(days).toBeLessThanOrEqual(0);
  });

  it('returns 0 for today', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const days = calculateRemainingDays(today.toISOString());
    expect(days).toBe(0);
  });
});
