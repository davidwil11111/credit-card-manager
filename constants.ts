
import { CreditCard, Transaction, RepaymentStatus, POSMachine } from './types';
import { toDateString } from './utils/date';

export function clampDayToMonth(year: number, month: number, day: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(day, daysInMonth);
}

// Determine the most recent bill date relative to a given transaction date (not today)
export function getTxLastBillDate(txDateStr: string, billDay: number): Date {
  const txDate = new Date(txDateStr);
  const txDay = txDate.getDate();
  const txMonth = txDate.getMonth();
  const txYear = txDate.getFullYear();

  if (txDay >= billDay) {
    return new Date(txYear, txMonth, clampDayToMonth(txYear, txMonth, billDay), 23, 59, 59, 999);
  } else {
    return new Date(txYear, txMonth - 1, clampDayToMonth(txYear, txMonth - 1, billDay), 23, 59, 59, 999);
  }
}

export const MOCK_BANKS = [
  '招商银行', '建设银行', '工商银行', '农业银行', '中国银行', 
  '交通银行', '邮储银行', '中信银行', '光大银行', '华夏银行', 
  '民生银行', '广发银行', '浦发银行', '平安银行', '兴业银行', 
  '恒丰银行', '浙商银行', '渤海银行', '北京银行', '上海银行'
];
export const MOCK_NAMES = ['张三', '李四', '王五', '赵六'];

// Helper to get bank brand colors
export const getBankTheme = (bankName: string) => {
    if (bankName.includes('招商') || bankName.includes('招行')) return 'from-red-600 to-rose-700';
    if (bankName.includes('工商') || bankName.includes('工行')) return 'from-red-600 to-orange-600';
    if (bankName.includes('建设') || bankName.includes('建行')) return 'from-blue-600 to-blue-800';
    if (bankName.includes('农业') || bankName.includes('农行')) return 'from-emerald-600 to-emerald-800';
    if (bankName.includes('中国银行')) return 'from-red-700 to-red-900';
    if (bankName.includes('交通') || bankName.includes('交行')) return 'from-blue-700 to-indigo-800';
    if (bankName.includes('平安')) return 'from-orange-500 to-red-500';
    if (bankName.includes('中信')) return 'from-red-600 to-red-800';
    if (bankName.includes('光大')) return 'from-yellow-500 to-orange-600';
    if (bankName.includes('浦发')) return 'from-blue-700 to-indigo-900';
    if (bankName.includes('民生')) return 'from-cyan-600 to-blue-700';
    if (bankName.includes('兴业')) return 'from-blue-500 to-blue-700';
    if (bankName.includes('广发')) return 'from-red-600 to-pink-700';
    if (bankName.includes('邮储')) return 'from-green-600 to-green-700';
    
    // Default
    return 'from-slate-600 to-slate-800';
};

export const DEFAULT_POS_MACHINES: POSMachine[] = [
  {
    id: 'pos_1',
    name: '标准费率POS',
    rate: 0.006,
    fixedFee: 0,
    channels: [
      { id: 'ch_1a', name: '刷卡', rate: 0.006, fixedFee: 0 },
      { id: 'ch_1b', name: '插卡', rate: 0.006, fixedFee: 0 },
      { id: 'ch_1c', name: '闪付', rate: 0.0055, fixedFee: 0 },
    ],
  },
  {
    id: 'pos_2',
    name: '优惠费率POS',
    rate: 0.0055,
    fixedFee: 3,
    channels: [
      { id: 'ch_2a', name: '支付宝', rate: 0.0038, fixedFee: 0 },
      { id: 'ch_2b', name: '微信', rate: 0.0038, fixedFee: 0 },
    ],
  },
  { id: 'pos_3', name: '大额专用POS', rate: 0.005, fixedFee: 0 },
  { id: 'pos_4', name: '线上快捷支付', rate: 0.0038, fixedFee: 0 },
];

export const calculateCardStatus = (unpaid: number, repaymentDateStr: string): RepaymentStatus => {
    const EPSILON = 0.001;
    if (unpaid < EPSILON) return 'paid';
    
    // Parse repayment date (YYYY-MM-DD) to compare with Today (ignoring time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const repaymentDate = new Date(repaymentDateStr);
    repaymentDate.setHours(0, 0, 0, 0);
    
    if (today > repaymentDate) return 'overdue';
    return 'pending';
};

// Calculate repayment date relative to specific Bill Date (Handles Cross-Year correctly)
export const calculateRepaymentDateForBill = (billDate: Date, config: CreditCard['repaymentConfig']): string => {
    // Copy date to avoid mutation
    const target = new Date(billDate);
    target.setHours(0,0,0,0);
    
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
};

export const calculateNextRepaymentDate = (billDay: number, config: CreditCard['repaymentConfig']): string => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); 
    
    let targetDate = new Date();
    
    if (config.type === 'fixed_day') {
        const fixedDay = config.value;
        if (today.getDate() <= fixedDay) {
            // e.g. Today 5th, Fixed 10th -> This month
            targetDate = new Date(currentYear, currentMonth, clampDayToMonth(currentYear, currentMonth, fixedDay));
        } else {
            // e.g. Today 15th, Fixed 10th -> Next month
            targetDate = new Date(currentYear, currentMonth + 1, clampDayToMonth(currentYear, currentMonth + 1, fixedDay));
        }
    } else {
        // days_after_bill logic relative to the LATEST bill date
        let billDate: Date;
        if (today.getDate() >= billDay) {
             // Bill already generated this month
             billDate = new Date(currentYear, currentMonth, clampDayToMonth(currentYear, currentMonth, billDay));
        } else {
             // Bill was last month
             billDate = new Date(currentYear, currentMonth - 1, clampDayToMonth(currentYear, currentMonth - 1, billDay));
        }

        targetDate = new Date(billDate);
        targetDate.setDate(billDate.getDate() + config.value);
    }

    return toDateString(targetDate);
};

// Helper to determine billing cycle range based on Bill Day
export const getStatementRange = (billDay: number) => {
    const now = new Date();
    const currentDay = now.getDate();
    
    let lastBillDate = new Date();
    
    // If today is past or is the bill day, the last bill was this month.
    if (currentDay >= billDay) {
        lastBillDate = new Date(now.getFullYear(), now.getMonth(), clampDayToMonth(now.getFullYear(), now.getMonth(), billDay));
    } else {
        // Else, last bill was last month.
        lastBillDate = new Date(now.getFullYear(), now.getMonth() - 1, clampDayToMonth(now.getFullYear(), now.getMonth() - 1, billDay));
    }
    lastBillDate.setHours(23, 59, 59, 999); // End of the bill day
    
    // The "Current Unpaid" bill covers the cycle ending on `lastBillDate`.
    // The cycle started one month before `lastBillDate` + 1 day.
    const prevBillDate = new Date(lastBillDate);
    prevBillDate.setMonth(prevBillDate.getMonth() - 1);
    prevBillDate.setDate(prevBillDate.getDate() + 1);
    prevBillDate.setHours(0, 0, 0, 0);
    
    const fmt = (d: Date) => `${d.getMonth()+1}/${d.getDate()}`;
    
    return {
        // e.g. "12/06-01/05"
        billCycleRange: `${fmt(prevBillDate)}-${fmt(lastBillDate)}`,
        lastBillDateObj: lastBillDate,
        prevBillDateObj: prevBillDate
    };
};

export interface BillCycle {
    label: string;
    start: Date;
    end: Date;
    key: string;
}

export const generateBillingCycles = (billDay: number): BillCycle[] => {
    const cycles: BillCycle[] = [];
    const now = new Date();
    
    // Calculate the 'Current Statement' end date (last passed bill day)
    let lastBillDate = new Date(now.getFullYear(), now.getMonth(), clampDayToMonth(now.getFullYear(), now.getMonth(), billDay));
    if (now.getDate() < billDay) {
        lastBillDate.setMonth(lastBillDate.getMonth() - 1);
    }
    lastBillDate.setHours(23, 59, 59, 999);

    // 1. Unbilled (Current Open)
    // Starts from lastBillDate + 1 ms
    // Ends at the Next Bill Date (approx 1 month from lastBillDate)
    const unbilledStart = new Date(lastBillDate);
    unbilledStart.setDate(unbilledStart.getDate() + 1);
    unbilledStart.setHours(0,0,0,0);
    
    const nextBillDate = new Date(lastBillDate);
    nextBillDate.setMonth(nextBillDate.getMonth() + 1);
    const reclampedDay = clampDayToMonth(nextBillDate.getFullYear(), nextBillDate.getMonth(), billDay);
    nextBillDate.setDate(reclampedDay);
    nextBillDate.setHours(23, 59, 59, 999);
    
    cycles.push({
        label: '未出账单', 
        start: unbilledStart,
        end: nextBillDate, 
        key: 'unbilled'
    });

    // 2. History (Current + Previous)
    // Generate 12 cycles back
    let endDate = new Date(lastBillDate);
    
    for (let i = 0; i < 12; i++) {
        const startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(0,0,0,0);
        
        // Include Year in the label for clarity (Correct Cross-Year Display)
        const fmt = (d: Date) => `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;

        cycles.push({
            label: `${fmt(startDate)} - ${fmt(endDate)}`,
            start: startDate,
            end: endDate,
            key: `cycle-${i}`
        });

        // Move back for next iteration
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
    }

    return cycles;
};

const generateTransactions = (count: number): Transaction[] => {
  const txs: Transaction[] = [];
  for (let i = 0; i < count; i++) {
    const isExpense = Math.random() > 0.3;
    const amount = Math.floor(Math.random() * 5000) + 100;
    
    txs.push({
      id: `tx-${Math.random().toString(36).substr(2, 9)}`,
      date: new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000).toISOString(),
      amount: isExpense ? -amount : amount, // Consumption is negative, Repayment is positive
      channel: isExpense ? (Math.random() > 0.5 ? '线上支付' : 'POS机刷卡') : '手机银行',
      merchantType: isExpense ? '通用消费' : '还款',
      cost: isExpense ? Math.floor(amount * 0.006) : 0, 
      actualReceipt: isExpense ? amount : 0,
      notes: isExpense ? '日常消费' : '本期还款',
      type: isExpense ? 'consumption' : 'repayment',
    });
  }
  return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const generateMockCards = (count: number): CreditCard[] => {
  return Array.from({ length: count }).map((_, idx) => {
    const limit = Math.floor(Math.random() * 50000) + 10000;
    const unpaid = Math.floor(Math.random() * (limit * 0.8));
    const unbilled = Math.floor(Math.random() * 5000);
    const billDay = Math.floor(Math.random() * 28) + 1;
    
    const repaymentConfig = { type: 'days_after_bill' as const, value: 20 };
    const repaymentDate = calculateNextRepaymentDate(billDay, repaymentConfig);
    const status = calculateCardStatus(unpaid, repaymentDate);

    // Initialize lastStatementDate to one month ago so new bills might trigger
    const lastStatement = new Date();
    lastStatement.setMonth(lastStatement.getMonth() - 1);

    return {
      id: `card-${Date.now()}-${idx}`,
      index: idx + 1,
      holderName: MOCK_NAMES[idx % MOCK_NAMES.length],
      bankName: MOCK_BANKS[idx % MOCK_BANKS.length],
      cardNumber: `${Math.floor(Math.random() * 8999) + 1000}`.slice(-4),
      billDay,
      repaymentConfig,
      repaymentDate,
      lastStatementDate: lastStatement.toISOString(),
      fixedLimit: limit,
      tempLimit: Math.random() > 0.8 ? 5000 : 0,
      tempLimitExpiry: Math.random() > 0.8 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      currentUnpaid: unpaid,
      currentUnbilled: unbilled,
      status: status,
      transactions: generateTransactions(15),
    };
  });
};
