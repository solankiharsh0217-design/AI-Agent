import { z } from 'zod';

export const BillingMetric = z.enum([
  'tokens_input',
  'tokens_output',
  'voice_minutes_stt',
  'voice_minutes_tts',
  'phone_minutes_inbound',
  'phone_minutes_outbound',
  'storage_mb',
  'vector_dimensions',
  'documents_processed',
  'api_calls',
  'conversations',
]);
export type BillingMetric = z.infer<typeof BillingMetric>;

export const PlanStatus = z.enum(['active', 'inactive', 'deprecated']);
export type PlanStatus = z.infer<typeof PlanStatus>;

export const PlanType = z.enum(['free', 'usage', 'tiered', 'custom']);
export type PlanType = z.infer<typeof PlanType>;

export const UsageRate = z.object({
  metric: BillingMetric,
  pricePerUnit: z.number().nonnegative(),
  unit: z.string(),
  includedUnits: z.number().int().nonnegative().default(0),
});
export type UsageRate = z.infer<typeof UsageRate>;

export const PlanPricing = z.object({
  basePrice: z.number().nonnegative().default(0),
  currency: z.string().length(3).default('USD'),
  interval: z.enum(['month', 'year']).default('month'),
  usageRates: z.array(UsageRate).default([]),
});
export type PlanPricing = z.infer<typeof PlanPricing>;

export const PlanLimits = z.object({
  maxAgents: z.number().int().nonnegative().default(10),
  maxKnowledgeBases: z.number().int().nonnegative().default(5),
  maxDocumentsPerKb: z.number().int().nonnegative().default(100),
  maxMonthlyMessages: z.number().int().nonnegative().default(10000),
  maxMonthlyVoiceMinutes: z.number().int().nonnegative().default(100),
  maxMonthlyPhoneMinutes: z.number().int().nonnegative().default(0),
  maxStorageMb: z.number().int().nonnegative().default(1000),
});
export type PlanLimits = z.infer<typeof PlanLimits>;

export const Plan = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  type: PlanType.default('usage'),
  status: PlanStatus.default('active'),
  pricing: PlanPricing,
  limits: PlanLimits.default({}),
  stripeProductId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Plan = z.infer<typeof Plan>;

export const SubscriptionStatus = z.enum([
  'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;

export const Subscription = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  planId: z.string().uuid(),
  stripeSubscriptionId: z.string().nullable(),
  stripeCustomerId: z.string().nullable(),
  status: SubscriptionStatus.default('trialing'),
  currentPeriodStart: z.date(),
  currentPeriodEnd: z.date(),
  trialEnd: z.date().nullable(),
  cancelAtPeriodEnd: z.boolean().default(false),
  canceledAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Subscription = z.infer<typeof Subscription>;

export const InvoiceStatus = z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']);
export type InvoiceStatus = z.infer<typeof InvoiceStatus>;

export const InvoiceLineItem = z.object({
  description: z.string(),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  amount: z.number().nonnegative(),
  metric: BillingMetric.nullable(),
});
export type InvoiceLineItem = z.infer<typeof InvoiceLineItem>;

export const Invoice = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  subscriptionId: z.string().uuid().nullable(),
  stripeInvoiceId: z.string().nullable(),
  number: z.string(),
  status: InvoiceStatus.default('draft'),
  amountDue: z.number().nonnegative(),
  amountPaid: z.number().nonnegative(),
  currency: z.string().length(3).default('USD'),
  periodStart: z.date(),
  periodEnd: z.date(),
  dueDate: z.date().nullable(),
  paidAt: z.date().nullable(),
  hostedInvoiceUrl: z.string().url().nullable(),
  lineItems: z.array(InvoiceLineItem).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Invoice = z.infer<typeof Invoice>;

export const UsageRecord = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  subscriptionId: z.string().uuid().nullable(),
  metric: BillingMetric,
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
  periodStart: z.date(),
  periodEnd: z.date(),
  reportedAt: z.date(),
  billedAt: z.date().nullable(),
});
export type UsageRecord = z.infer<typeof UsageRecord>;
