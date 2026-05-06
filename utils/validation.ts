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

export const importDataSchema = z.object({
  version: z.string().optional(),
  exportedAt: z.string().optional(),
  cards: z.array(creditCardSchema),
  posMachines: z.array(posMachineSchema),
});

export const creditCardFormSchema = z.object({
  holderName: z.string().min(2, '姓名过短'),
  bankName: z.string().min(1, '请选择银行'),
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
