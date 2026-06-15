import { InstallmentPlan, InstallmentPeriod, Transaction } from '../types';
import { clampDayToMonth } from '../constants';
import { toDateString } from './date';

export const VALID_PERIODS = [3, 6, 9, 12, 18, 24, 36];

export interface InstallmentInput {
  principal: number;
  annualRate: number;
  totalPeriods: number;
  startDate: string;
  billDay: number;
  notes?: string;
}

export interface EarlySettlementResult {
  remainingPrincipal: number;
  overdueInterest: number;
  interestReduction: number;
  settlementAmount: number;
}

export function calculateInstallmentPlan(
  principal: number,
  annualRate: number,
  totalPeriods: number,
  startDate: string,
  billDay: number,
  notes?: string
): InstallmentPlan {
  if (principal <= 0) throw new Error('分期金额必须大于0');
  if (annualRate < 0 || annualRate > 0.36) throw new Error('年化利率需在0-36%之间');
  if (!VALID_PERIODS.includes(totalPeriods)) throw new Error(`分期期数需为 ${VALID_PERIODS.join('/')}`);

  const r = annualRate / 12;
  const N = totalPeriods;

  let monthlyPayment: number;
  if (r === 0) {
    monthlyPayment = principal / N;
  } else {
    const factor = Math.pow(1 + r, N);
    monthlyPayment = principal * r * factor / (factor - 1);
  }

  const periods: InstallmentPeriod[] = [];
  let remainingPrincipal = principal;

  const startD = new Date(startDate);
  startD.setHours(0, 0, 0, 0);

  for (let i = 0; i < N; i++) {
    let interest: number;
    let periodPrincipal: number;

    if (r === 0) {
      periodPrincipal = monthlyPayment;
      interest = 0;
    } else {
      const inverseIndex = N - i;
      periodPrincipal = monthlyPayment / Math.pow(1 + r, inverseIndex);
      interest = monthlyPayment - periodPrincipal;
    }

    // Round to cents
    periodPrincipal = Math.round(periodPrincipal * 100) / 100;
    interest = Math.round(interest * 100) / 100;

    remainingPrincipal = Math.round((remainingPrincipal - periodPrincipal) * 100) / 100;
    if (i === N - 1 && Math.abs(remainingPrincipal) > 0.005) {
      // Adjust last period to zero out principal
      periodPrincipal += remainingPrincipal;
      remainingPrincipal = 0;
    }

    // Calculate due date: startDate + (i+1) months, clamped to billDay
    const dueDate = new Date(startD);
    dueDate.setMonth(dueDate.getMonth() + i + 1);
    const clampedDay = clampDayToMonth(dueDate.getFullYear(), dueDate.getMonth(), billDay);
    dueDate.setDate(clampedDay);
    dueDate.setHours(0, 0, 0, 0);

    periods.push({
      period: i + 1,
      dueDate: toDateString(dueDate),
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      principal: periodPrincipal,
      interest,
      remainingPrincipal: Math.max(0, remainingPrincipal),
      status: 'pending',
    });
  }

  return {
    id: `ip-${Date.now()}`,
    cardId: '',
    startDate,
    principal,
    annualRate,
    totalPeriods,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    periods,
    status: 'active',
    notes,
  };
}

export function calculateEarlySettlement(
  plan: InstallmentPlan,
  settlementDate: string
): EarlySettlementResult {
  const settleD = new Date(settlementDate);
  settleD.setHours(23, 59, 59, 999);

  let remainingPrincipal = 0;
  let overdueInterest = 0;
  let interestReduction = 0;

  for (const period of plan.periods) {
    const dueD = new Date(period.dueDate);
    dueD.setHours(23, 59, 59, 999);

    if (period.status === 'paid') continue;

    if (dueD > settleD) {
      // Future period — principal still owed, interest waived
      remainingPrincipal += period.principal;
      interestReduction += period.interest;
    } else {
      // Past due — principal not yet paid (shouldn't really happen separately),
      // interest owed
      remainingPrincipal += period.principal;
      overdueInterest += period.interest;
    }
  }

  remainingPrincipal = Math.round(remainingPrincipal * 100) / 100;
  overdueInterest = Math.round(overdueInterest * 100) / 100;
  interestReduction = Math.round(interestReduction * 100) / 100;

  return {
    remainingPrincipal,
    overdueInterest,
    interestReduction,
    settlementAmount: Math.round((remainingPrincipal + overdueInterest) * 100) / 100,
  };
}

export function generateInstallmentTransactions(plan: InstallmentPlan): Transaction[] {
  const txs: Transaction[] = [];

  // Installment start — records the new debt (positive amount = liability increase)
  txs.push({
    id: `tx-${Date.now()}-start`,
    date: plan.startDate,
    amount: plan.principal,
    type: 'installment_start',
    channel: '分期',
    merchantType: '账单分期',
    cost: 0,
    actualReceipt: plan.principal,
    notes: plan.notes || '办理分期',
  });

  // Each period generates a loan_bill (negative amount = payment outflow)
  for (const period of plan.periods) {
    txs.push({
      id: `tx-${Date.now()}-${plan.id}-p${period.period}`,
      date: period.dueDate,
      amount: -(period.monthlyPayment),
      type: 'loan_bill',
      channel: '分期月供',
      merchantType: '账单分期',
      cost: period.interest,
      actualReceipt: period.principal,
      notes: `分期第${period.period}期/${plan.totalPeriods}期`,
    });
  }

  return txs;
}
