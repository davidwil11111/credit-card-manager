export type RepaymentStatus = 'paid' | 'pending' | 'overdue';

export type TransactionType = 'consumption' | 'repayment' | 'loan_bill' | 'installment_start';

export type RepaymentConfigType = 'fixed_day' | 'days_after_bill';

export interface RepaymentConfig {
  type: RepaymentConfigType;
  value: number;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  channel: string;
  merchantType: string;
  cost: number;
  actualReceipt: number;
  notes: string;
  posId?: string;
}

export interface CreditCard {
  id: string;
  index: number;
  holderName: string;
  bankName: string;
  cardNumber: string;
  billDay: number;
  repaymentConfig: RepaymentConfig;
  repaymentDate: string;
  lastStatementDate: string;
  fixedLimit: number;
  tempLimit: number;
  tempLimitExpiry?: string;
  currentUnpaid: number;
  currentUnbilled: number;
  status: RepaymentStatus;
  transactions: Transaction[];
}

export interface Channel {
  id: string;
  name: string;
  rate: number;
  fixedFee: number;
}

export interface POSMachine {
  id: string;
  name: string;
  rate: number;
  fixedFee: number;
  channels?: Channel[];
}

export interface GlobalStats {
  totalAvailable: number;
  totalUnpaid: number;
  totalLimit: number;
  totalUnbilled: number;
  availableRatio: number;
  overdueCount: number;
}
