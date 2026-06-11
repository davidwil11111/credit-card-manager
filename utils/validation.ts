import { z } from 'zod';

export const channelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rate: z.number().min(0).max(1),
  fixedFee: z.number().min(0),
});

export const transactionSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  amount: z.number(),
  type: z.enum(['consumption', 'repayment', 'loan_bill', 'installment_start']),
  channel: z.string(),
  merchantType: z.string(),
  cost: z.number(),
  actualReceipt: z.number(),
  notes: z.string(),
  posId: z.string().optional(),
});

export const repaymentConfigSchema = z.object({
  type: z.enum(['fixed_day', 'days_after_bill']),
  value: z.number(),
});

export const creditCardSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().min(0),
  holderName: z.string().min(1),
  bankName: z.string().min(1),
  cardNumber: z.string().min(1),
  billDay: z.number().int().min(1).max(31),
  repaymentConfig: repaymentConfigSchema,
  repaymentDate: z.string(),
  lastStatementDate: z.string(),
  fixedLimit: z.number(),
  tempLimit: z.number(),
  tempLimitExpiry: z.string().optional(),
  currentUnpaid: z.number(),
  currentUnbilled: z.number(),
  statementAmount: z.number(),
  status: z.enum(['paid', 'pending', 'overdue']),
  transactions: z.array(transactionSchema),
});

export const posMachineSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rate: z.number().min(0).max(1),
  fixedFee: z.number().min(0),
  channels: z.array(channelSchema).optional(),
});

export const installmentPeriodSchema = z.object({
  period: z.number().int().min(1),
  dueDate: z.string().min(1),
  monthlyPayment: z.number().min(0),
  principal: z.number().min(0),
  interest: z.number().min(0),
  remainingPrincipal: z.number().min(0),
  status: z.enum(['pending', 'paid', 'overdue']),
});

export const installmentPlanSchema = z.object({
  id: z.string().min(1),
  cardId: z.string().min(1),
  startDate: z.string().min(1),
  principal: z.number().positive(),
  annualRate: z.number().min(0).max(0.36),
  totalPeriods: z.number().int().min(1).max(36),
  monthlyPayment: z.number().min(0),
  periods: z.array(installmentPeriodSchema),
  status: z.enum(['active', 'settled']),
  settledDate: z.string().optional(),
  settledAmount: z.number().optional(),
  notes: z.string().optional(),
});

export const importDataSchema = z.object({
  version: z.string().optional(),
  exportedAt: z.string().optional(),
  cards: z.array(creditCardSchema),
  posMachines: z.array(posMachineSchema),
  installmentPlans: z.array(installmentPlanSchema).optional(),
});

export const creditCardFormSchema = z.object({
  holderName: z.string().min(1, '请输入持卡人姓名'),
  bankName: z.string().min(1, '请选择或输入银行'),
  cardNumber: z.string().regex(/^\d{4}$/, '请填写4位卡号'),
  billDay: z.number().int().min(1, '请选择账单日'),
});

export function safeParseJson<T>(raw: string | null, schema: z.ZodSchema<T>, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}
