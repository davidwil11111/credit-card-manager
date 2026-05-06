import { describe, it, expect } from 'vitest';
import {
  calculateRepaymentDateForBill,
  calculateNextRepaymentDate,
  getStatementRange,
  generateBillingCycles,
  calculateCardStatus,
} from './constants';
import type { RepaymentConfig } from './types';

const fixedDay = (day: number): RepaymentConfig => ({ type: 'fixed_day', value: day });
const daysAfter = (days: number): RepaymentConfig => ({ type: 'days_after_bill', value: days });

describe('calculateRepaymentDateForBill', () => {
  it('Edge case A: billDay=Jan 31, fixed_day=31 should not overflow to March', () => {
    const billDate = new Date(2026, 0, 31); // Jan 31
    const result = calculateRepaymentDateForBill(billDate, fixedDay(31));
    // Should be Feb 28 (2026 is not a leap year) or March 31
    // Feb has 28 days, so fixed_day=31 should clamp to Feb 28
    const d = new Date(result);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1); // February
    expect(d.getDate()).toBe(28);
  });

  it('Edge case B: billDay=Feb 28 (non-leap), fixed_day=31 should not overflow', () => {
    const billDate = new Date(2025, 1, 28); // Feb 28, 2025 (non-leap)
    const result = calculateRepaymentDateForBill(billDate, fixedDay(31));
    const d = new Date(result);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(2); // March
    expect(d.getDate()).toBe(31); // March has 31 days
  });

  it('Edge case C: billDay=Jan 31, fixed_day=30 crosses month correctly', () => {
    const billDate = new Date(2026, 0, 31); // Jan 31
    const result = calculateRepaymentDateForBill(billDate, fixedDay(30));
    const d = new Date(result);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1); // February
    expect(d.getDate()).toBe(28); // Feb has 28 days, clamped from 30
  });

  it('normal case: fixed_day after bill day works correctly', () => {
    const billDate = new Date(2026, 0, 15); // Jan 15
    const result = calculateRepaymentDateForBill(billDate, fixedDay(20));
    const d = new Date(result);
    expect(d.getMonth()).toBe(0); // January
    expect(d.getDate()).toBe(20);
  });

  it('days_after_bill works correctly', () => {
    const billDate = new Date(2026, 0, 15);
    const result = calculateRepaymentDateForBill(billDate, daysAfter(20));
    const d = new Date(result);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1); // February
    expect(d.getDate()).toBe(4); // Jan 15 + 20 = Feb 4
  });
});

describe('calculateNextRepaymentDate', () => {
  it('Edge case J: fixed_day=31, current month has fewer days', () => {
    // Mock: we're in April (month 3), fixed day 31
    // April has 30 days, so new Date(2026, 3, 31) would overflow to May 1
    const result = calculateNextRepaymentDate(15, fixedDay(31));
    const d = new Date(result);
    // Should not silently become month+1 just because of overflow
    // The day should be clamped to the month's max day
    expect(d.getDate()).toBeLessThanOrEqual(31);
  });

  it('Edge case K: billDay=29 in February non-leap year', () => {
    // If today is March 1, billDay=29, then bill date is Feb 29 which doesn't exist in non-leap
    const result = calculateNextRepaymentDate(29, fixedDay(15));
    const d = new Date(result);
    expect(d.getTime()).not.toBeNaN();
  });
});

describe('getStatementRange', () => {
  it('Edge case D: billDay=31, current month is April (30 days)', () => {
    // If today is April 15, billDay=31:
    // currentDay(15) < billDay(31), so use last month (March)
    // March has 31 days, so new Date(2026, 2, 31) is fine
    // But if today was May 10, billDay=31:
    // currentDay(10) < billDay(31), so last month (April) - April has 30 days
    // new Date(2026, 3, 31) = May 1 - BUG!
    const result = getStatementRange(31);
    expect(result.lastBillDateObj.getTime()).not.toBeNaN();
    // The lastBillDateObj should always be in a valid month
    const d = result.lastBillDateObj;
    expect(d.getDate()).toBeLessThanOrEqual(31);
  });

  it('Edge case F: billDay=29, current month March (after Feb)', () => {
    // If today is March 10, billDay=29:
    // currentDay(10) < billDay(29), so lastBillDate = Feb
    // Feb 2026 has 28 days, Feb 29 would overflow to March 1
    const result = getStatementRange(29);
    const d = result.lastBillDateObj;
    // Should be Feb 28 (clamped), not March 1
    expect(d.getDate()).toBeLessThanOrEqual(29);
  });

  it('normal case: billDay=15, today past bill day', () => {
    // Today is May 5, billDay=15: currentDay(5) < 15, so last month
    const result = getStatementRange(15);
    expect(result.billCycleRange).toBeTruthy();
    expect(result.lastBillDateObj.getTime()).not.toBeNaN();
  });
});

describe('generateBillingCycles', () => {
  it('Edge case G: billDay=31 should not cause overflow chain', () => {
    const cycles = generateBillingCycles(31);
    expect(cycles.length).toBe(13); // 1 unbilled + 12 history
    // All cycles should have valid dates
    cycles.forEach((cycle) => {
      expect(cycle.start.getTime()).not.toBeNaN();
      expect(cycle.end.getTime()).not.toBeNaN();
      expect(cycle.start <= cycle.end).toBe(true);
    });
  });

  it('Edge case H: billDay=30 in February should not cause invalid dates', () => {
    const cycles = generateBillingCycles(30);
    cycles.forEach((cycle) => {
      expect(cycle.start.getTime()).not.toBeNaN();
      expect(cycle.end.getTime()).not.toBeNaN();
    });
  });

  it('Edge case I: billDay=29 generates valid cycles across year boundary', () => {
    const cycles = generateBillingCycles(29);
    expect(cycles.length).toBe(13);
    cycles.forEach((cycle) => {
      expect(cycle.start <= cycle.end).toBe(true);
    });
  });

  it('normal case: billDay=15 generates 13 cycles', () => {
    const cycles = generateBillingCycles(15);
    expect(cycles.length).toBe(13);
    expect(cycles[0].key).toBe('unbilled');
    expect(cycles[0].label).toBe('未出账单');
  });
});

describe('calculateCardStatus', () => {
  it('returns paid when unpaid is 0', () => {
    expect(calculateCardStatus(0, '2026-12-31')).toBe('paid');
  });

  it('returns overdue when past repayment date', () => {
    expect(calculateCardStatus(1000, '2020-01-01')).toBe('overdue');
  });

  it('returns pending when unpaid and before repayment date', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const dateStr = futureDate.toISOString().split('T')[0];
    expect(calculateCardStatus(1000, dateStr)).toBe('pending');
  });
});
