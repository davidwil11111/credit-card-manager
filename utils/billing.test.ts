import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  clampDayToMonth,
  getStatementRange,
  getTxLastBillDate,
  generateBillingCycles,
  calculateNextRepaymentDate,
  calculateRepaymentDateForBill,
  calculateCardStatus,
  classifyTransactionAmount,
  generateStatement,
} from './billing';

// Helper: freeze Date.now to a known date
function setNow(year: number, month: number, day: number) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(year, month, day, 12, 0, 0));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('clampDayToMonth', () => {
  it('returns the same day when within bounds', () => {
    expect(clampDayToMonth(2026, 0, 15)).toBe(15);  // Jan 2026
    expect(clampDayToMonth(2026, 5, 30)).toBe(30);  // Jun 2026
  });

  it('clamps to last day when day exceeds month length', () => {
    expect(clampDayToMonth(2026, 1, 31)).toBe(28);  // Feb 2026
    expect(clampDayToMonth(2024, 1, 31)).toBe(29);  // Feb 2024 (leap)
    expect(clampDayToMonth(2026, 3, 31)).toBe(30);  // Apr 2026
  });
});

describe('getStatementRange', () => {
  beforeEach(() => setNow(2026, 5, 15)); // Jun 15, 2026

  it('returns last/next/prev bill dates for billDay=15 (today === billDay)', () => {
    const { lastBillDateObj, nextBillDateObj, prevBillDateObj } = getStatementRange(15);
    expect(lastBillDateObj.getDate()).toBe(15);
    expect(lastBillDateObj.getMonth()).toBe(5); // June
    expect(lastBillDateObj.getFullYear()).toBe(2026);
    expect(lastBillDateObj.getHours()).toBe(23);

    expect(prevBillDateObj.getMonth()).toBe(4); // May
    expect(nextBillDateObj.getMonth()).toBe(6); // July
  });

  it('billDay=10 (today > billDay): last bill is this month', () => {
    const { lastBillDateObj } = getStatementRange(10);
    expect(lastBillDateObj.getDate()).toBe(10);
    expect(lastBillDateObj.getMonth()).toBe(5); // June
  });

  it('billDay=20 (today < billDay): last bill is last month', () => {
    const { lastBillDateObj } = getStatementRange(20);
    expect(lastBillDateObj.getDate()).toBe(20);
    expect(lastBillDateObj.getMonth()).toBe(4); // May
  });

  it('billDay=31 in a 30-day month clamps correctly', () => {
    setNow(2026, 3, 15); // April 15
    const { lastBillDateObj } = getStatementRange(31);
    expect(lastBillDateObj.getDate()).toBe(30); // Apr has 30 days
    expect(lastBillDateObj.getMonth()).toBe(2);
  });
});

describe('getTxLastBillDate', () => {
  it('tx after billDay: bill date is same month', () => {
    const result = getTxLastBillDate('2026-06-20T10:00:00', 15);
    expect(result.getDate()).toBe(15);
    expect(result.getMonth()).toBe(5); // June
    expect(result.getFullYear()).toBe(2026);
    expect(result.getHours()).toBe(23);
  });

  it('tx before billDay: bill date is previous month', () => {
    const result = getTxLastBillDate('2026-06-10T10:00:00', 15);
    expect(result.getDate()).toBe(15);
    expect(result.getMonth()).toBe(4); // May
    expect(result.getFullYear()).toBe(2026);
  });

  it('tx on billDay exactly: same month', () => {
    const result = getTxLastBillDate('2026-06-15T08:00:00', 15);
    expect(result.getMonth()).toBe(5); // June
  });

  it('handles January correctly (prev month = December of prev year)', () => {
    const result = getTxLastBillDate('2026-01-05T10:00:00', 15);
    expect(result.getDate()).toBe(15);
    expect(result.getMonth()).toBe(11); // December
    expect(result.getFullYear()).toBe(2025);
  });
});

describe('generateBillingCycles', () => {
  beforeEach(() => setNow(2026, 5, 15)); // Jun 15, 2026

  it('returns 13 cycles (1 unbilled + 12 historical)', () => {
    const cycles = generateBillingCycles(15);
    expect(cycles.length).toBe(13);
  });

  it('first cycle is "unbilled"', () => {
    const cycles = generateBillingCycles(15);
    expect(cycles[0].key).toBe('unbilled');
    expect(cycles[0].label).toBe('未出账单');
  });

  it('unbilled cycle starts after last bill date', () => {
    const cycles = generateBillingCycles(15);
    expect(cycles[0].start.getDate()).toBe(16); // Jun 16
    expect(cycles[0].start.getMonth()).toBe(5);
  });

  it('historical cycles are in descending order', () => {
    const cycles = generateBillingCycles(15);
    for (let i = 1; i < cycles.length - 1; i++) {
      expect(cycles[i].end.getTime()).toBeGreaterThan(cycles[i + 1].end.getTime());
    }
  });
});

describe('calculateNextRepaymentDate', () => {
  beforeEach(() => setNow(2026, 5, 15)); // Jun 15, 2026

  it('days_after_bill: billDay=15, value=20 => Jul 5', () => {
    const result = calculateNextRepaymentDate(15, { type: 'days_after_bill', value: 20 });
    // last bill = Jun 15, +20 days = Jul 5
    expect(result).toBe('2026-07-05');
  });

  it('days_after_bill: billDay=1, value=25 => Jun 26', () => {
    const result = calculateNextRepaymentDate(1, { type: 'days_after_bill', value: 25 });
    // last bill = Jun 1, +25 days = Jun 26
    expect(result).toBe('2026-06-26');
  });

  it('fixed_day: billDay=10, fixed=20, today=15 < 20 => this month', () => {
    setNow(2026, 5, 15);
    const result = calculateNextRepaymentDate(10, { type: 'fixed_day', value: 20 });
    expect(result).toBe('2026-06-20');
  });

  it('fixed_day: billDay=10, fixed=25, today=26 > 25 => next month', () => {
    setNow(2026, 5, 26);
    const result = calculateNextRepaymentDate(10, { type: 'fixed_day', value: 25 });
    expect(result).toBe('2026-07-25');
  });
});

describe('calculateRepaymentDateForBill', () => {
  it('fixed_day: when fixed day is after bill date, same month', () => {
    const billDate = new Date(2026, 5, 15); // Jun 15
    const result = calculateRepaymentDateForBill(billDate, { type: 'fixed_day', value: 20 });
    expect(result).toBe('2026-06-20');
  });

  it('fixed_day: when fixed day is before or on bill date, next month', () => {
    const billDate = new Date(2026, 5, 15); // Jun 15
    const result = calculateRepaymentDateForBill(billDate, { type: 'fixed_day', value: 15 });
    expect(result).toBe('2026-07-15');
  });

  it('days_after_bill: adds days to bill date', () => {
    const billDate = new Date(2026, 5, 15);
    const result = calculateRepaymentDateForBill(billDate, { type: 'days_after_bill', value: 25 });
    expect(result).toBe('2026-07-10');
  });

  it('clamps February 30/31 when crossing month end', () => {
    const billDate = new Date(2026, 0, 31); // Jan 31
    const result = calculateRepaymentDateForBill(billDate, { type: 'days_after_bill', value: 30 });
    expect(result).toBe('2026-03-02'); // Jan 31 + 30 = Mar 2
  });
});

describe('calculateCardStatus', () => {
  beforeEach(() => setNow(2026, 5, 15)); // Jun 15, 2026

  it('returns "paid" when unpaid is 0', () => {
    expect(calculateCardStatus(0, '2026-06-20')).toBe('paid');
  });

  it('returns "overdue" when today exceeds repayment date', () => {
    expect(calculateCardStatus(100, '2026-06-10')).toBe('overdue');
  });

  it('returns "pending" when repayment date is in the future', () => {
    expect(calculateCardStatus(100, '2026-06-25')).toBe('pending');
  });

  it('returns "pending" when repayment date is today', () => {
    expect(calculateCardStatus(100, '2026-06-15')).toBe('pending');
  });
});

describe('classifyTransactionAmount', () => {
  beforeEach(() => setNow(2026, 5, 15)); // Jun 15, 2026, billDay 10

  it('tx after last bill date => goes to unbilled', () => {
    const result = classifyTransactionAmount('2026-06-12T10:00:00', 100, 10, 500, 200);
    expect(result.unpaid).toBe(500);
    expect(result.unbilled).toBe(300);
  });

  it('tx before or on last bill date => goes to unpaid', () => {
    const result = classifyTransactionAmount('2026-06-08T10:00:00', 100, 10, 500, 200);
    expect(result.unpaid).toBe(600);
    expect(result.unbilled).toBe(200);
  });
});

describe('generateStatement', () => {
  it('generates statement from consumption transactions before bill date', () => {
    const mockCard = {
      id: 'card-1',
      transactions: [
        { id: 'tx1', date: '2026-06-10T10:00:00', type: 'consumption', amount: -500 },
        { id: 'tx2', date: '2026-06-12T10:00:00', type: 'consumption', amount: -300 },
        { id: 'tx3', date: '2026-06-18T10:00:00', type: 'consumption', amount: -200 },
        { id: 'tx4', date: '2026-06-15T10:00:00', type: 'repayment', amount: 400 },
      ],
    } as any;

    const billDate = new Date(2026, 5, 15, 23, 59, 59, 999); // Jun 15
    const result = generateStatement(mockCard, billDate);
    expect(result.statementAmount).toBe(800); // tx1(500) + tx2(300)
    expect(result.transactionsInStatement.length).toBe(2);
    expect(result.updatedTransactions.length).toBe(4);
    expect(result.updatedTransactions[0].statementId).toContain('stmt-');
    expect(result.updatedTransactions[2].statementId).toBeUndefined(); // tx3 after billDate
    expect(result.updatedTransactions[3].statementId).toBeUndefined(); // repayment
  });

  it('skips transactions that already have a statementId', () => {
    const mockCard = {
      id: 'card-1',
      transactions: [
        { id: 'tx1', date: '2026-06-10T10:00:00', type: 'consumption', amount: -500, statementId: 'stmt-old' },
      ],
    } as any;

    const billDate = new Date(2026, 5, 15, 23, 59, 59, 999);
    const result = generateStatement(mockCard, billDate);
    expect(result.statementAmount).toBe(0);
    expect(result.transactionsInStatement.length).toBe(0);
  });
});
