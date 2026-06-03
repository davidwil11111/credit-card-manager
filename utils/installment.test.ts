import { describe, it, expect } from 'vitest';
import { calculateInstallmentPlan, calculateEarlySettlement, generateInstallmentTransactions, VALID_PERIODS } from './installment';

const billDay = 15;
const startDate = '2026-05-06';

describe('calculateInstallmentPlan', () => {
  it('standard 12-period equal installment calculation', () => {
    const plan = calculateInstallmentPlan(12000, 0.12, 12, startDate, billDay);
    expect(plan.periods.length).toBe(12);
    expect(plan.status).toBe('active');
    expect(plan.principal).toBe(12000);
    expect(plan.monthlyPayment).toBeGreaterThan(1060);
    expect(plan.monthlyPayment).toBeLessThan(1070);

    // Sum of principals should equal total principal
    const totalPrincipal = plan.periods.reduce((s, p) => s + p.principal, 0);
    expect(Math.abs(totalPrincipal - 12000)).toBeLessThan(0.1);

    // First period should have more interest than last
    expect(plan.periods[0].interest).toBeGreaterThan(plan.periods[11].interest);
  });

  it('0% interest rate', () => {
    const plan = calculateInstallmentPlan(10000, 0, 6, startDate, billDay);
    expect(plan.periods.length).toBe(6);
    for (const p of plan.periods) {
      expect(p.interest).toBe(0);
      expect(Math.abs(p.principal - 10000 / 6)).toBeLessThan(0.1);
    }
  });

  it('36% max rate', () => {
    const plan = calculateInstallmentPlan(5000, 0.36, 3, startDate, billDay);
    expect(plan.periods.length).toBe(3);
    const totalPrincipal = plan.periods.reduce((s, p) => s + p.principal, 0);
    expect(Math.abs(totalPrincipal - 5000)).toBeLessThan(0.1);
  });

  it('remaining principal decreases correctly', () => {
    const plan = calculateInstallmentPlan(6000, 0.06, 6, startDate, billDay);
    let prevRemaining = plan.principal;
    for (const p of plan.periods) {
      expect(p.remainingPrincipal).toBeLessThan(prevRemaining + 0.01);
      prevRemaining = p.remainingPrincipal;
    }
    // Last period remaining should be ~0
    expect(plan.periods[5].remainingPrincipal).toBeLessThan(0.1);
  });

  it('due dates are correctly spaced and clamped to bill day', () => {
    const plan = calculateInstallmentPlan(3000, 0.05, 3, '2026-01-06', 15);
    // Period 1 due date: Feb 15 (clamped from billDay=15)
    expect(plan.periods[0].dueDate).toContain('-02-15');
    expect(plan.periods[1].dueDate).toContain('-03-15');
    expect(plan.periods[2].dueDate).toContain('-04-15');
  });

  it('rejects invalid principal', () => {
    expect(() => calculateInstallmentPlan(0, 0.1, 6, startDate, billDay)).toThrow();
    expect(() => calculateInstallmentPlan(-100, 0.1, 6, startDate, billDay)).toThrow();
  });

  it('rejects invalid rate', () => {
    expect(() => calculateInstallmentPlan(5000, -0.01, 6, startDate, billDay)).toThrow();
    expect(() => calculateInstallmentPlan(5000, 0.5, 6, startDate, billDay)).toThrow();
  });

  it('rejects invalid period count', () => {
    expect(() => calculateInstallmentPlan(5000, 0.1, 5, startDate, billDay)).toThrow();
    expect(() => calculateInstallmentPlan(5000, 0.1, 48, startDate, billDay)).toThrow();
  });
});

describe('calculateEarlySettlement', () => {
  const plan = calculateInstallmentPlan(12000, 0.12, 12, '2026-01-06', 15);

  it('all periods pending, settle before first due date', () => {
    const result = calculateEarlySettlement(plan, '2026-01-20');
    expect(result.remainingPrincipal).toBeGreaterThan(11900);
    expect(result.overdueInterest).toBe(0);
    expect(result.interestReduction).toBeGreaterThan(0);
    expect(result.settlementAmount).toBe(result.remainingPrincipal + result.overdueInterest);
  });

  it('some periods past due with overdue interest', () => {
    // Mark first 2 periods as overdue, settle after period 1's due date
    const modifiedPlan = { ...plan, periods: plan.periods.map((p, i) => ({
      ...p, status: i < 2 ? 'overdue' as const : p.status,
    })) };
    // Settle one day after period 1's due date
    const settleD = new Date(plan.periods[1].dueDate);
    settleD.setDate(settleD.getDate() + 1);
    const result = calculateEarlySettlement(modifiedPlan, settleD.toISOString().split('T')[0]);
    expect(result.overdueInterest).toBeGreaterThan(0);
    expect(result.remainingPrincipal).toBeGreaterThan(0);
  });

  it('all paid — nothing to settle', () => {
    const paidPlan = { ...plan, periods: plan.periods.map(p => ({ ...p, status: 'paid' as const })) };
    const result = calculateEarlySettlement(paidPlan, '2027-01-01');
    expect(result.remainingPrincipal).toBe(0);
    expect(result.overdueInterest).toBe(0);
    expect(result.settlementAmount).toBe(0);
  });
});

describe('generateInstallmentTransactions', () => {
  const plan = calculateInstallmentPlan(6000, 0.06, 3, startDate, billDay);

  it('generates N+1 transactions', () => {
    const txs = generateInstallmentTransactions(plan);
    expect(txs.length).toBe(4); // 1 start + 3 bills
  });

  it('first transaction is installment_start with correct amount', () => {
    const txs = generateInstallmentTransactions(plan);
    expect(txs[0].type).toBe('installment_start');
    expect(txs[0].amount).toBe(6000);
    expect(txs[0].merchantType).toBe('账单分期');
  });

  it('bill transactions have correct structure', () => {
    const txs = generateInstallmentTransactions(plan);
    const bills = txs.filter(t => t.type === 'loan_bill');
    expect(bills.length).toBe(3);
    for (const bill of bills) {
      expect(bill.amount).toBeLessThan(0);
      expect(bill.cost).toBeGreaterThan(0);
      expect(bill.merchantType).toBe('账单分期');
      expect(bill.channel).toBe('分期月供');
    }
  });
});
