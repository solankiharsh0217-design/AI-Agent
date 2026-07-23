import { eq, and, desc, or } from 'drizzle-orm';
import { plans, subscriptions, invoices } from '../schema/billing';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { generateId } from '../helpers';


export class PlanRepository {
  constructor(private db: DrizzleD1Database) {}

  async findById(id: string) {
    const row = await this.db.select().from(plans).where(eq(plans.id, id));
    return row[0] ?? null;
  }

  async findBySlug(slug: string) {
    const row = await this.db.select().from(plans).where(eq(plans.slug, slug));
    return row[0] ?? null;
  }

  async list() {
    return this.db.select().from(plans).orderBy(desc(plans.createdAt));
  }
}

export class SubscriptionRepository {
  constructor(private db: DrizzleD1Database) {}

  async create(data: { tenantId: string; planId: string; stripeSubscriptionId?: string; stripeCustomerId?: string; status?: string; currentPeriodStart: Date; currentPeriodEnd: Date; trialEnd?: Date }) {
    const id = generateId();
    const now = new Date();
    await this.db.insert(subscriptions).values({
      id,
      tenantId: data.tenantId,
      planId: data.planId,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      stripeCustomerId: data.stripeCustomerId ?? null,
      status: (data.status as any) ?? 'trialing',
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      trialEnd: data.trialEnd ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(id, data.tenantId);
  }

  async findById(id: string, tenantId: string) {
    const row = await this.db.select().from(subscriptions).where(and(eq(subscriptions.id, id), eq(subscriptions.tenantId, tenantId)));
    return row[0] ?? null;
  }

  async findByTenantId(tenantId: string) {
    return this.db.select().from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.createdAt));
  }

  async findActiveByTenantId(tenantId: string) {
    const row = await this.db.select().from(subscriptions)
      .where(and(
        eq(subscriptions.tenantId, tenantId),
        or(eq(subscriptions.status, 'active'), eq(subscriptions.status, 'trialing'))
      ));
    return row[0] ?? null;
  }

  async findByExternalSubscriptionId(externalSubId: string, tenantId?: string) {
    if (tenantId) {
      const row = await this.db.select().from(subscriptions)
        .where(and(eq(subscriptions.stripeSubscriptionId, externalSubId), eq(subscriptions.tenantId, tenantId)))
        .orderBy(desc(subscriptions.createdAt));
      return row[0] ?? null;
    }
    const row = await this.db.select().from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, externalSubId))
      .orderBy(desc(subscriptions.createdAt));
    return row[0] ?? null;
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<{
      planId: string;
      stripeSubscriptionId: string | null;
      stripeCustomerId: string | null;
      status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused';
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      cancelAtPeriodEnd: boolean;
      canceledAt: Date;
    }>
  ) {
    const updateData: Record<string, unknown> = {};
    if (data.planId !== undefined) updateData.planId = data.planId;
    if (data.stripeSubscriptionId !== undefined) updateData.stripeSubscriptionId = data.stripeSubscriptionId;
    if (data.stripeCustomerId !== undefined) updateData.stripeCustomerId = data.stripeCustomerId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.currentPeriodStart !== undefined) updateData.currentPeriodStart = data.currentPeriodStart;
    if (data.currentPeriodEnd !== undefined) updateData.currentPeriodEnd = data.currentPeriodEnd;
    if (data.cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = data.cancelAtPeriodEnd;
    if (data.canceledAt !== undefined) updateData.canceledAt = data.canceledAt;
    updateData.updatedAt = new Date();
    await this.db.update(subscriptions).set(updateData).where(and(eq(subscriptions.id, id), eq(subscriptions.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }
}

export class InvoiceRepository {
  constructor(private db: DrizzleD1Database) {}

  async create(data: { tenantId: string; subscriptionId?: string; stripeInvoiceId?: string; number: string; status?: string; amountDue: number; currency?: string; periodStart: Date; periodEnd: Date; dueDate?: Date; lineItems?: Record<string, unknown>[] }) {
    const id = generateId();
    const now = new Date();
    await this.db.insert(invoices).values({
      id,
      tenantId: data.tenantId,
      subscriptionId: data.subscriptionId ?? null,
      stripeInvoiceId: data.stripeInvoiceId ?? null,
      number: data.number,
      status: (data.status as any) ?? 'draft',
      amountDue: data.amountDue,
      amountPaid: 0,
      currency: data.currency ?? 'USD',
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      dueDate: data.dueDate ?? null,
      lineItems: data.lineItems ?? [],
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(id, data.tenantId);
  }

  async findById(id: string, tenantId: string) {
    const row = await this.db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
    return row[0] ?? null;
  }

  async findByTenantId(tenantId: string) {
    return this.db.select().from(invoices)
      .where(eq(invoices.tenantId, tenantId))
      .orderBy(desc(invoices.createdAt));
  }

  async findBySubscriptionId(subscriptionId: string, tenantId: string) {
    const row = await this.db.select().from(invoices)
      .where(and(eq(invoices.subscriptionId, subscriptionId), eq(invoices.tenantId, tenantId)))
      .orderBy(desc(invoices.createdAt))
      .limit(1);
    return row[0] ?? null;
  }

  async update(id: string, tenantId: string, data: Partial<{ status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'; amountPaid: number; paidAt: Date; hostedInvoiceUrl: string; stripeInvoiceId: string }>) {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.amountPaid !== undefined) updateData.amountPaid = data.amountPaid;
    if (data.paidAt !== undefined) updateData.paidAt = data.paidAt;
    if (data.hostedInvoiceUrl !== undefined) updateData.hostedInvoiceUrl = data.hostedInvoiceUrl;
    if (data.stripeInvoiceId !== undefined) updateData.stripeInvoiceId = data.stripeInvoiceId;
    updateData.updatedAt = new Date();
    await this.db.update(invoices).set(updateData).where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }
}
