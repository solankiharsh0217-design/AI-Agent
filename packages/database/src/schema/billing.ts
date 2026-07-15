import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  type: text('type', { enum: ['free', 'usage', 'tiered', 'custom'] }).notNull().default('usage'),
  status: text('status', { enum: ['active', 'inactive', 'deprecated'] }).notNull().default('active'),
  pricing: text('pricing', { mode: 'json' }).notNull().default('{}'),
  limits: text('limits', { mode: 'json' }).notNull().default('{}'),
  stripeProductId: text('stripe_product_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  planId: text('plan_id').notNull().references(() => plans.id),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeCustomerId: text('stripe_customer_id'),
  status: text('status', { enum: ['trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'] }).notNull().default('trialing'),
  currentPeriodStart: integer('current_period_start', { mode: 'timestamp' }).notNull(),
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }).notNull(),
  trialEnd: integer('trial_end', { mode: 'timestamp' }),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),
  canceledAt: integer('canceled_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  idx_subscriptions_tenant_id: index('idx_subscriptions_tenant_id').on(t.tenantId),
  idx_subscriptions_status: index('idx_subscriptions_status').on(t.status),
  idx_subscriptions_stripe_id: index('idx_subscriptions_stripe_id').on(t.stripeSubscriptionId),
  idx_subscriptions_plan_id: index('idx_subscriptions_plan_id').on(t.planId),
}));

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  subscriptionId: text('subscription_id').references(() => subscriptions.id),
  stripeInvoiceId: text('stripe_invoice_id'),
  number: text('number').notNull(),
  status: text('status', { enum: ['draft', 'open', 'paid', 'void', 'uncollectible'] }).notNull().default('draft'),
  amountDue: real('amount_due').notNull().default(0),
  amountPaid: real('amount_paid').notNull().default(0),
  currency: text('currency', { length: 3 }).notNull().default('USD'),
  periodStart: integer('period_start', { mode: 'timestamp' }).notNull(),
  periodEnd: integer('period_end', { mode: 'timestamp' }).notNull(),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  hostedInvoiceUrl: text('hosted_invoice_url'),
  lineItems: text('line_items', { mode: 'json' }).notNull().default('[]'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  idx_invoices_tenant_id: index('idx_invoices_tenant_id').on(t.tenantId),
  idx_invoices_status: index('idx_invoices_status').on(t.status),
}));
