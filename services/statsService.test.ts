import { describe, it, expect } from 'vitest';
import { calculateGlobalStats, calculateCardAvailable, calculateCardAvailableRatio } from './statsService';
import { CreditCard } from '../types';

const makeCard = (overrides: Partial<CreditCard> = {}): CreditCard => ({
  id: '1',
  index: 1,
  holderName: '张三',
  bankName: '招商银行',
  cardNumber: '1234',
  billDay: 5,
  repaymentConfig: { type: 'days_after_bill', value: 20 },
  repaymentDate: '2025-01-25',
  lastStatementDate: '2025-01-05',
  fixedLimit: 10000,
  tempLimit: 0,
  currentUnpaid: 3000,
  currentUnbilled: 1000,
  statementAmount: 3000,
  status: 'pending',
  transactions: [],
  ...overrides,
});

describe('calculateGlobalStats', () => {
  it('应正确计算多张卡片的全局统计', () => {
    const cards: CreditCard[] = [
      makeCard({ id: '1', fixedLimit: 10000, tempLimit: 2000, tempLimitExpiry: '2028-12-31', currentUnpaid: 3000, currentUnbilled: 1000, status: 'pending' }),
      makeCard({ id: '2', fixedLimit: 20000, tempLimit: 0,              currentUnpaid: 5000, currentUnbilled: 2000, status: 'overdue' }),
    ];

    const stats = calculateGlobalStats(cards);

    expect(stats.totalLimit).toBe(32000);        // (10000+2000) + 20000
    expect(stats.totalUnpaid).toBe(8000);          // 3000 + 5000
    expect(stats.totalUnbilled).toBe(3000);        // 1000 + 2000
    expect(stats.totalAvailable).toBe(21000);      // 32000 - 8000 - 3000
    expect(stats.availableRatio).toBeCloseTo(65.625, 2); // 21000/32000*100
    expect(stats.overdueCount).toBe(1);
  });

  it('应正确处理空数组', () => {
    const stats = calculateGlobalStats([]);

    expect(stats.totalLimit).toBe(0);
    expect(stats.totalUnpaid).toBe(0);
    expect(stats.totalUnbilled).toBe(0);
    expect(stats.totalAvailable).toBe(0);
    expect(stats.availableRatio).toBe(0);
    expect(stats.overdueCount).toBe(0);
  });

  it('应排除已过期的临时额度', () => {
    const cards: CreditCard[] = [
      makeCard({ id: '1', fixedLimit: 10000, tempLimit: 5000, tempLimitExpiry: '2020-01-01', currentUnpaid: 0, currentUnbilled: 0 }),
    ];

    const stats = calculateGlobalStats(cards);

    expect(stats.totalLimit).toBe(10000); // 临时额度已过期，不计入
  });

  it('应计入无到期日的临时额度', () => {
    const cards: CreditCard[] = [
      makeCard({ id: '1', fixedLimit: 10000, tempLimit: 5000, tempLimitExpiry: undefined, currentUnpaid: 0, currentUnbilled: 0 }),
    ];

    const stats = calculateGlobalStats(cards);

    expect(stats.totalLimit).toBe(15000); // 10000 + 5000
  });

  it('总额度为0时可用比例为0', () => {
    const cards: CreditCard[] = [
      makeCard({ id: '1', fixedLimit: 0, tempLimit: 0, currentUnpaid: 0, currentUnbilled: 0 }),
    ];

    const stats = calculateGlobalStats(cards);

    expect(stats.availableRatio).toBe(0);
  });
});

describe('calculateCardAvailable', () => {
  it('应正确计算单张卡片的可用额度', () => {
    const card = makeCard({
      fixedLimit: 10000, tempLimit: 2000, tempLimitExpiry: '2028-12-31',
      currentUnpaid: 3000, currentUnbilled: 1000,
    });

    expect(calculateCardAvailable(card)).toBe(8000); // 10000+2000-3000-1000
  });

  it('临时额度过期后应只使用固定额度', () => {
    const card = makeCard({
      fixedLimit: 10000, tempLimit: 5000, tempLimitExpiry: '2020-01-01',
      currentUnpaid: 2000, currentUnbilled: 500,
    });

    expect(calculateCardAvailable(card)).toBe(7500); // 10000-2000-500
  });
});

describe('calculateCardAvailableRatio', () => {
  it('应正确计算可用比例', () => {
    const card = makeCard({
      fixedLimit: 10000, tempLimit: 2000, tempLimitExpiry: '2028-12-31',
      currentUnpaid: 3000, currentUnbilled: 1000,
    });

    expect(calculateCardAvailableRatio(card)).toBeCloseTo(80, 2); // 8000/10000*100
  });

  it('固定额度为0时应返回0', () => {
    const card = makeCard({ fixedLimit: 0 });

    expect(calculateCardAvailableRatio(card)).toBe(0);
  });
});
