
import { CreditCard, Transaction, RepaymentStatus, POSMachine } from './types';
import { toDateString } from './utils/date';
export { clampDayToMonth, getTxLastBillDate, calculateCardStatus, calculateRepaymentDateForBill, calculateNextRepaymentDate, getStatementRange, generateBillingCycles } from './utils/billing';
export type { BillCycle, RepaymentConfig, CardStatus } from './utils/billing';

export const MOCK_BANKS = [
  '招商银行',
  '建设银行',
  '工商银行',
  '农业银行',
  '中国银行',
  '交通银行',
  '邮储银行',
  '中信银行',
  '光大银行',
  '华夏银行',
  '民生银行',
  '广发银行',
  '浦发银行',
  '平安银行',
  '兴业银行',
  '恒丰银行',
  '浙商银行',
  '渤海银行',
  '北京银行',
  '上海银行'
];
export const MOCK_NAMES = ['张三', '李四', '王五', '赵六'];

// Helper to get bank brand colors (gradient for headers)
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

// Check if temp limit is currently valid
export const isTempLimitValid = (card: CreditCard): boolean => {
    if (!card.tempLimit || card.tempLimit <= 0) return false;
    if (!card.tempLimitExpiry) return true; // no expiry set, assume valid
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(card.tempLimitExpiry);
    expiry.setHours(0, 0, 0, 0);
    return expiry >= today;
};
export const getBankDetailGradient = (bankName: string): { start: string; end: string } => {
    if (bankName.includes('招商') || bankName.includes('招行')) return { start: '#c62828', end: '#ef5350' };
    if (bankName.includes('工商') || bankName.includes('工行')) return { start: '#c62828', end: '#f57c00' };
    if (bankName.includes('建设') || bankName.includes('建行')) return { start: '#10439f', end: '#3b82f6' };
    if (bankName.includes('农业') || bankName.includes('农行')) return { start: '#0d7c63', end: '#34d399' };
    if (bankName.includes('中国银行')) return { start: '#991b1b', end: '#ef4444' };
    if (bankName.includes('交通') || bankName.includes('交行')) return { start: '#1e40af', end: '#6366f1' };
    if (bankName.includes('平安')) return { start: '#c2410c', end: '#f97316' };
    if (bankName.includes('中信')) return { start: '#b91c1c', end: '#f87171' };
    if (bankName.includes('光大')) return { start: '#a16207', end: '#facc15' };
    if (bankName.includes('浦发')) return { start: '#00338d', end: '#4a8af4' };
    if (bankName.includes('民生')) return { start: '#007f7e', end: '#2dd4bf' };
    if (bankName.includes('兴业')) return { start: '#1d4ed8', end: '#60a5fa' };
    if (bankName.includes('广发')) return { start: '#b91c1c', end: '#f472b6' };
    if (bankName.includes('邮储')) return { start: '#166534', end: '#4ade80' };
    if (bankName.includes('华夏')) return { start: '#1e40af', end: '#60a5fa' };
    if (bankName.includes('北京')) return { start: '#991b1b', end: '#f87171' };
    if (bankName.includes('上海')) return { start: '#1e40af', end: '#60a5fa' };
    return { start: '#124af0', end: '#306eff' };
};

// Helper to get bank solid color for circle avatars (inner)
export const getBankColor = (bankName: string): string => {
    if (bankName.includes('招商') || bankName.includes('招行')) return '#E60012';
    if (bankName.includes('工商') || bankName.includes('工行')) return '#C8102E';
    if (bankName.includes('建设') || bankName.includes('建行')) return '#005BAC';
    if (bankName.includes('农业') || bankName.includes('农行')) return '#00897B';
    if (bankName.includes('中国银行')) return '#AD1D21';
    if (bankName.includes('交通') || bankName.includes('交行')) return '#005BAC';
    if (bankName.includes('平安')) return '#EA5504';
    if (bankName.includes('中信')) return '#C8102E';
    if (bankName.includes('光大')) return '#7B2D8B';
    if (bankName.includes('浦发')) return '#00338D';
    if (bankName.includes('民生')) return '#007F7E';
    if (bankName.includes('兴业')) return '#005BAC';
    if (bankName.includes('广发')) return '#CE0037';
    if (bankName.includes('邮储')) return '#008000';
    if (bankName.includes('华夏')) return '#005BAC';
    if (bankName.includes('北京')) return '#C8102E';
    if (bankName.includes('上海')) return '#005BAC';
    if (bankName.includes('恒丰')) return '#3F51B5';
    if (bankName.includes('浙商')) return '#005BAC';
    if (bankName.includes('渤海')) return '#00897B';
    return '#4B5563';
};

// Helper to get bank avatar outer ring color (Tailwind bg class)
export const getBankAvatarOuter = (bankName: string): string => {
    if (bankName.includes('招商') || bankName.includes('招行')) return 'bg-red-50';
    if (bankName.includes('工商') || bankName.includes('工行')) return 'bg-red-50';
    if (bankName.includes('建设') || bankName.includes('建行')) return 'bg-blue-50';
    if (bankName.includes('农业') || bankName.includes('农行')) return 'bg-emerald-50';
    if (bankName.includes('中国银行')) return 'bg-red-50';
    if (bankName.includes('交通') || bankName.includes('交行')) return 'bg-blue-50';
    if (bankName.includes('平安')) return 'bg-orange-50';
    if (bankName.includes('中信')) return 'bg-red-50';
    if (bankName.includes('光大')) return 'bg-purple-50';
    if (bankName.includes('浦发')) return 'bg-blue-50';
    if (bankName.includes('民生')) return 'bg-teal-50';
    if (bankName.includes('兴业')) return 'bg-blue-50';
    if (bankName.includes('广发')) return 'bg-red-50';
    if (bankName.includes('邮储')) return 'bg-green-50';
    if (bankName.includes('华夏')) return 'bg-blue-50';
    if (bankName.includes('北京')) return 'bg-red-50';
    if (bankName.includes('上海')) return 'bg-blue-50';
    if (bankName.includes('恒丰')) return 'bg-indigo-50';
    if (bankName.includes('浙商')) return 'bg-blue-50';
    if (bankName.includes('渤海')) return 'bg-emerald-50';
    return 'bg-gray-50';
};

// Get Material Symbol icon name for each bank
export const getBankIcon = (bankName: string): string => {
    if (bankName.includes('招商') || bankName.includes('招行')) return 'account_balance';
    if (bankName.includes('工商') || bankName.includes('工行')) return 'savings';
    if (bankName.includes('建设') || bankName.includes('建行')) return 'home';
    if (bankName.includes('农业') || bankName.includes('农行')) return 'eco';
    if (bankName.includes('中国银行')) return 'tower';
    if (bankName.includes('交通') || bankName.includes('交行')) return 'commute';
    if (bankName.includes('平安')) return 'shield';
    if (bankName.includes('中信')) return 'credit_card';
    if (bankName.includes('光大')) return 'light';
    if (bankName.includes('浦发')) return 'bolt';
    if (bankName.includes('民生')) return 'volunteer_activism';
    if (bankName.includes('兴业')) return 'trending_up';
    if (bankName.includes('广发')) return 'globe_asia';
    if (bankName.includes('邮储')) return 'local_shipping';
    if (bankName.includes('华夏')) return 'diamond';
    if (bankName.includes('北京')) return 'location_city';
    if (bankName.includes('上海')) return 'water';
    if (bankName.includes('恒丰')) return 'stars';
    if (bankName.includes('浙商')) return 'storefront';
    if (bankName.includes('渤海')) return 'anchor';
    return 'account_balance_wallet';
};

// Calculate monthly spend (calendar month) for all cards
export const getMonthlySpend = (cards: CreditCard[]): { current: number; previous: number } => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let current = 0;
    let previous = 0;
    
    cards.forEach(card => {
        card.transactions.forEach(tx => {
            if (tx.type !== 'consumption') return;
            const txDate = new Date(tx.date);
            const amount = Math.abs(tx.amount);
            
            if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
                current += amount;
            } else if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth - 1 ||
                       (currentMonth === 0 && txDate.getFullYear() === currentYear - 1 && txDate.getMonth() === 11)) {
                previous += amount;
            }
        });
    });
    
    return { current, previous };
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
      { id: 'ch_2a', name: '支付通', rate: 0.0038, fixedFee: 0 },
      { id: 'ch_2b', name: '微信', rate: 0.0038, fixedFee: 0 },
    ],
  },
  { id: 'pos_3', name: '大额专用POS', rate: 0.005, fixedFee: 0 },
  { id: 'pos_4', name: '线上快捷支付', rate: 0.0038, fixedFee: 0 },
];

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
      statementAmount: unpaid,
      currentUnpaid: unpaid,
      currentUnbilled: unbilled,
      status: status,
      transactions: generateTransactions(15),
    };
  });
};

