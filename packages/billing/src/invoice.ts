import { InvoiceRepository, UsageRepository, PlanRepository, SubscriptionRepository } from '@ai-agent/database';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { InvoiceStatus, BillingMetric } from '@ai-agent/types';
import { PricingEngine, type InvoiceLineItemInput } from './pricing';
import { AppError } from '@ai-agent/shared';
import crypto from 'crypto';

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export class InvoiceManager {
  private invoiceRepo: InvoiceRepository;
  private usageRepo: UsageRepository;
  private planRepo: PlanRepository;
  private subscriptionRepo: SubscriptionRepository;
  private pricing: PricingEngine;

  constructor(db: DrizzleD1Database) {
    this.invoiceRepo = new InvoiceRepository(db);
    this.usageRepo = new UsageRepository(db);
    this.planRepo = new PlanRepository(db);
    this.subscriptionRepo = new SubscriptionRepository(db);
    this.pricing = new PricingEngine();
  }

  async generateInvoice(
    tenantId: string,
    period: { start: Date; end: Date }
  ) {
    const subscription = await this.subscriptionRepo.findActiveByTenantId(tenantId);
    if (!subscription) {
      throw new AppError('NO_SUBSCRIPTION', 'No active subscription found for tenant', { statusCode: 404 });
    }

    const plan = await this.planRepo.findById(subscription.planId);
    if (!plan) {
      throw new AppError('PLAN_NOT_FOUND', 'Plan not found', { statusCode: 404 });
    }

    const usageRecords = await this.usageRepo.getUsageByTenant(tenantId, {
      from: period.start,
      to: period.end,
    });

    const usageByMetric = new Map<string, number>();
    for (const record of usageRecords) {
      const current = usageByMetric.get(record.event) ?? 0;
      usageByMetric.set(record.event, current + record.totalQuantity);
    }

    const billingUsage: InvoiceLineItemInput[] = [];
    for (const [metric, quantity] of usageByMetric) {
      billingUsage.push({ metric: metric as BillingMetric, quantity });
    }

    const planSlug = plan.slug;
    const result = this.pricing.calculateInvoice(planSlug, billingUsage);

    const invoiceNumber = `INV-${Date.now().toString(36)}-${crypto.randomUUID().split('-')[0]}`.toUpperCase();
    const dueDate = new Date(period.end);
    dueDate.setDate(dueDate.getDate() + 14);

    const invoice = await this.invoiceRepo.create({
      tenantId,
      subscriptionId: subscription.id,
      number: invoiceNumber,
      status: 'open',
      amountDue: result.total,
      currency: 'USD',
      periodStart: period.start,
      periodEnd: period.end,
      dueDate,
      lineItems: [
        ...result.lineItems,
        {
          description: `Base plan: ${plan.name}`,
          quantity: 1,
          unitPrice: result.basePrice,
          amount: result.basePrice,
          metric: null,
        },
      ],
    });

    return invoice;
  }

  async getInvoice(invoiceId: string, tenantId: string) {
    const invoice = await this.invoiceRepo.findById(invoiceId, tenantId);
    if (!invoice) {
      throw new AppError('INVOICE_NOT_FOUND', 'Invoice not found', { statusCode: 404 });
    }
    return invoice;
  }

  async getInvoices(tenantId: string, pagination: PaginationParams = {}) {
    const page = pagination.page ?? 1;
    const pageSize = pagination.pageSize ?? 20;

    const allInvoices = await this.invoiceRepo.findByTenantId(tenantId);
    const start = (page - 1) * pageSize;
    const items = allInvoices.slice(start, start + pageSize);

    return {
      items,
      total: allInvoices.length,
      page,
      pageSize,
      totalPages: Math.ceil(allInvoices.length / pageSize),
    };
  }

  async markPaid(invoiceId: string, tenantId: string, paymentRef: string) {
    const invoice = await this.invoiceRepo.findById(invoiceId, tenantId);
    if (!invoice) {
      throw new AppError('INVOICE_NOT_FOUND', 'Invoice not found', { statusCode: 404 });
    }

    if (invoice.status === 'paid') {
      throw new AppError('INVOICE_ALREADY_PAID', 'Invoice is already paid', { statusCode: 409 });
    }

    if (invoice.status === 'void' || invoice.status === 'uncollectible') {
      throw new AppError('INVOICE_INVALID_STATUS', `Cannot mark ${invoice.status} invoice as paid`, { statusCode: 409 });
    }

    const updated = await this.invoiceRepo.update(invoiceId, tenantId, {
      status: 'paid',
      amountPaid: invoice.amountDue,
      paidAt: new Date(),
      stripeInvoiceId: paymentRef,
    });

    return updated;
  }
}
