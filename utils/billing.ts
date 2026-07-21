import { CreditCard, Transaction } from '../types';
import { toDateString } from './date';

/**
 * Clamp a day-of-month to the actual days in a given month.
 * e.g. clampDayToMonth(2026, 1, 31) => 28 for Feb 2026
 */
export function clampDayToMonth(year: number, month: number, day: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(day, daysInMonth);
}

/**
 * Get the start and end dates for the current billing cycle,
 * based on the card's billDay.
 *
 * - lastBillDateObj: the most recent statement date (bill day that has passed)
 * - nextBillDateObj: the upcoming statement date
 * - prevBillDateObj: the statement date before the most recent one
 */
export function getStatementRange(billDay: number): {
  lastBillDateObj: Date;
  nextBillDateObj: Date;
  prevBillDateObj: Date;
} {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let lastBillDate = new Date(
    currentYear,
    currentMonth,
    clampDayToMonth(currentYear, currentMonth, billDay),
    23, 59, 59, 999
  );

  if (now.getDate() < billDay) {
    lastBillDate.setMonth(lastBillDate.getMonth() - 1);
  }

  const prevBillDate = new Date(lastBillDate);
  prevBillDate.setMonth(prevBillDate.getMonth() - 1);

  const nextBillDate = new Date(lastBillDate);
  nextBillDate.setMonth(nextBillDate.getMonth() + 1);
  nextBillDate.setDate(clampDayToMonth(
    nextBillDate.getFullYear(),
    nextBillDate.getMonth(),
    billDay
  ));

    const fmt = (d: Date) => `${d.getMonth()+1}/${d.getDate()}`;
  return {
    lastBillDateObj: lastBillDate,
    nextBillDateObj: nextBillDate,
    prevBillDateObj: prevBillDate,
    billCycleRange: fmt(prevBillDate) + '-' + fmt(lastBillDate),
  };
}

/**
 * Determine the most recent bill date relative to a transaction date.
 */
export function getTxLastBillDate(txDateStr: string, billDay: number): Date {
  const txDate = new Date(txDateStr);
  const txDay = txDate.getDate();
  const txMonth = txDate.getMonth();
  const txYear = txDate.getFullYear();

  if (txDay >= billDay) {
    return new Date(
      txYear, txMonth,
      clampDayToMonth(txYear, txMonth, billDay),
      23, 59, 59, 999
    );
  } else {
    return new Date(
      txYear, txMonth - 1,
      clampDayToMonth(txYear, txMonth - 1, billDay),
      23, 59, 59, 999
    );
  }
}

export interface BillCycle {
  label: string;
  start: Date;
  end: Date;
  key: string;
}

/**
 * Generate billing cycles for display (unbilled + 12 historical cycles).
 */
export function generateBillingCycles(billDay: number): BillCycle[] {
  const cycles: BillCycle[] = [];
  const now = new Date();

  const { lastBillDateObj: lastBillDate, nextBillDateObj: nextBillDate } = getStatementRange(billDay);

  // 1. Unbilled cycle: from last bill date +1 to next bill date
  const unbilledStart = new Date(lastBillDate);
  unbilledStart.setDate(unbilledStart.getDate() + 1);
  unbilledStart.setHours(0, 0, 0, 0);

  cycles.push({
    label: '未出账单',
    start: unbilledStart,
    end: new Date(nextBillDate),
    key: 'unbilled',
  });

  // 2. Historical cycles (12 months back)
  let endDate = new Date(lastBillDate);
  for (let i = 0; i < 12; i++) {
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);

    const fmt = (d: Date) =>
      `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;

    cycles.push({
      label: `${fmt(startDate)} - ${fmt(endDate)}`,
      start: startDate,
      end: endDate,
      key: `cycle-${i}`,
    });

    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);
  }

  return cycles;
}

export type RepaymentConfig =
  | { type: 'days_after_bill'; value: number }
  | { type: 'fixed_day'; value: number };

/**
 * Calculate the repayment date given a billDay and repayment config.
 */
export function calculateNextRepaymentDate(
  billDay: number,
  config: RepaymentConfig
): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  let targetDate: Date;

  if (config.type === 'fixed_day') {
    const fixedDay = config.value;
    if (today.getDate() <= fixedDay) {
      targetDate = new Date(year, month, clampDayToMonth(year, month, fixedDay));
    } else {
      targetDate = new Date(year, month + 1, clampDayToMonth(year, month + 1, fixedDay));
    }
  } else {
    // days_after_bill: relative to last bill date
    const { lastBillDateObj: lastBill } = getStatementRange(billDay);
    targetDate = new Date(lastBill);
    targetDate.setDate(lastBill.getDate() + config.value);
  }

  return toDateString(targetDate);
}

export type CardStatus = 'paid' | 'overdue' | 'pending';

/**
 * Determine card status based on unpaid amount and repayment date.
 */
export function calculateCardStatus(
  currentUnpaid: number,
  repaymentDate: string
): CardStatus {
  if (currentUnpaid <= 0) return 'paid';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const repayDate = new Date(repaymentDate);
  repayDate.setHours(0, 0, 0, 0);
  return today > repayDate ? 'overdue' : 'pending';
}

/**
 * Calculate repayment date relative to a specific bill date (handles cross-year correctly).
 */
export function calculateRepaymentDateForBill(
  billDate: Date,
  config: RepaymentConfig
): string {
  const target = new Date(billDate);
  target.setHours(0, 0, 0, 0);

  if (config.type === 'fixed_day') {
    const fixedDay = config.value;
    const clampedDay = clampDayToMonth(target.getFullYear(), target.getMonth(), fixedDay);
    target.setDate(clampedDay);

    if (target <= billDate) {
      target.setDate(1);
      target.setMonth(target.getMonth() + 1);
      const reclamped = clampDayToMonth(target.getFullYear(), target.getMonth(), fixedDay);
      target.setDate(reclamped);
    }
  } else {
    // days_after_bill
    target.setDate(target.getDate() + config.value);
  }

  return toDateString(target);
}

/**
 * Check which bill period a consumption transaction belongs to,
 * and return the updated unpaid/unbilled amounts.
 */
export function classifyTransactionAmount(
  txDate: string,
  amount: number,
  billDay: number,
  currentUnpaid: number,
  currentUnbilled: number
): { unpaid: number; unbilled: number } {
  const txDateObj = new Date(txDate);
  const { lastBillDateObj } = getStatementRange(billDay);

  if (txDateObj > lastBillDateObj) {
    return { unpaid: currentUnpaid, unbilled: currentUnbilled + Math.abs(amount) };
  }
  return { unpaid: currentUnpaid + Math.abs(amount), unbilled: currentUnbilled };
}

/**
 * Calculate a new statement when a billing cycle closes.
 */
export function generateStatement(
  card: CreditCard,
  billDate: Date
): {
  statementAmount: number;
  statementDate: string;
  transactionsInStatement: Transaction[];
  updatedTransactions: Transaction[];
} {
  const billTs = billDate.getTime();

  const transactionsInStatement: Transaction[] = [];
  const updatedTransactions: Transaction[] = [];

  for (const tx of card.transactions) {
    const txTs = new Date(tx.date).getTime();
    if (txTs <= billTs && tx.type === 'consumption' && !tx.statementId) {
      transactionsInStatement.push(tx);
      updatedTransactions.push({ ...tx, statementId: `stmt-${billTs}` });
    } else {
      updatedTransactions.push(tx);
    }
  }

  const statementAmount = transactionsInStatement.reduce(
    (sum, tx) => sum + Math.abs(tx.amount),
    0
  );

  return {
    statementAmount,
    statementDate: toDateString(new Date(billTs)),
    transactionsInStatement,
    updatedTransactions,
  };
}

