import { SubscriptionRepository, PlanRepository } from '@ai-agent/database';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { PricingEngine } from './pricing';
import { AppError } from '@ai-agent/shared';

const FEATURE_ACCESS: Record<string, string[]> = {
  free: ['basic_chat', 'basic_knowledge'],
  starter: ['basic_chat', 'basic_knowledge', 'voice_calls', 'phone_numbers', 'api_access'],
  pro: ['basic_chat', 'basic_knowledge', 'voice_calls', 'phone_numbers', 'api_access', 'custom_agents', 'analytics', 'webhooks'],
  enterprise: ['basic_chat', 'basic_knowledge', 'voice_calls', 'phone_numbers', 'api_access', 'custom_agents', 'analytics', 'webhooks', 'sso', 'audit_logs', 'priority_support', 'custom_integrations'],
};

function addOneMonth(date: Date): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + 1;
  result.setMonth(targetMonth);
  if (result.getMonth() !== targetMonth % 12) {
    result.setDate(0);
  }
  return result;
}

export class SubscriptionManager {
  private subscriptionRepo: SubscriptionRepository;
  private planRepo: PlanRepository;
  private pricing: PricingEngine;
  private razorpayKeyId?: string;
  private razorpayKeySecret?: string;

  constructor(db: DrizzleD1Database, razorpayKeyId?: string, razorpayKeySecret?: string) {
    this.subscriptionRepo = new SubscriptionRepository(db);
    this.planRepo = new PlanRepository(db);
    this.pricing = new PricingEngine();
    this.razorpayKeyId = razorpayKeyId;
    this.razorpayKeySecret = razorpayKeySecret;
  }

  async createSubscription(tenantId: string, planSlug: string) {
    const existing = await this.subscriptionRepo.findActiveByTenantId(tenantId);
    if (existing) {
      throw new AppError('CONFLICT', 'Tenant already has an active subscription', { statusCode: 409 });
    }

    const plan = await this.planRepo.findBySlug(planSlug);
    if (!plan) {
      throw new AppError('NOT_FOUND', `Plan not found: ${planSlug}`, { statusCode: 404 });
    }

    const now = new Date();
    const periodEnd = addOneMonth(now);

    const subscription = await this.subscriptionRepo.create({
      tenantId,
      planId: plan.id,
      status: plan.type === 'free' ? 'active' : 'trialing',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEnd: plan.type === 'free' ? undefined : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    });

    return subscription;
  }

  async upgradePlan(tenantId: string, newPlanSlug: string) {
    const subscription = await this.subscriptionRepo.findActiveByTenantId(tenantId);
    if (!subscription) {
      throw new AppError('NOT_FOUND', 'Active subscription not found', { statusCode: 404 });
    }

    const newPlan = await this.planRepo.findBySlug(newPlanSlug);
    if (!newPlan) {
      throw new AppError('NOT_FOUND', `Plan not found: ${newPlanSlug}`, { statusCode: 404 });
    }

    if (subscription.planId === newPlan.id) {
      throw new AppError('CONFLICT', 'Already on this plan', { statusCode: 409 });
    }

    const updated = await this.subscriptionRepo.update(subscription.id, tenantId, {
      planId: newPlan.id,
    });

    return updated;
  }

  async reactivateSubscription(tenantId: string) {
    const subscription = await this.subscriptionRepo.findActiveByTenantId(tenantId);
    if (!subscription) {
      throw new AppError('NOT_FOUND', 'No subscription to reactivate', { statusCode: 404 });
    }

    // Resume the Razorpay subscription if one exists (undo cancel_at_cycle_end).
    if (subscription.stripeSubscriptionId && this.razorpayKeyId && this.razorpayKeySecret) {
      try {
        await fetch(`https://api.razorpay.com/v1/subscriptions/${subscription.stripeSubscriptionId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Basic ${btoa(`${this.razorpayKeyId}:${this.razorpayKeySecret}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cancel_at_cycle_end: 0 }),
        });
      } catch (error) {
        console.error('Failed to resume Razorpay subscription', { error: (error as Error).message });
      }
    }

    const updated = await this.subscriptionRepo.update(subscription.id, tenantId, {
      cancelAtPeriodEnd: false,
      status: 'active',
      canceledAt: null as unknown as Date,
    });

    return updated;
  }

  async cancelSubscription(tenantId: string) {
    const subscription = await this.subscriptionRepo.findActiveByTenantId(tenantId);
    if (!subscription) {
      throw new AppError('NOT_FOUND', 'Active subscription not found', { statusCode: 404 });
    }

    if (subscription.status === 'canceled') {
      return subscription;
    }

    if (subscription.stripeSubscriptionId && this.razorpayKeyId && this.razorpayKeySecret) {
      try {
        await fetch(`https://api.razorpay.com/v1/subscriptions/${subscription.stripeSubscriptionId}/cancel`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${this.razorpayKeyId}:${this.razorpayKeySecret}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cancel_at_cycle_end: 1 }),
        });
      } catch (error) {
        // Log but don't fail - we still update local state
        console.error('Failed to cancel Razorpay subscription', { error: (error as Error).message });
      }
    }

    const updated = await this.subscriptionRepo.update(subscription.id, tenantId, {
      cancelAtPeriodEnd: true,
      status: 'canceled',
      canceledAt: new Date(),
    });

    return updated;
  }

  async updateSubscriptionPaymentDetails(
    tenantId: string,
    stripeSubscriptionId: string,
    stripeCustomerId?: string
  ) {
    const subscription = await this.subscriptionRepo.findActiveByTenantId(tenantId);
    if (!subscription) {
      throw new AppError('NOT_FOUND', 'Active subscription not found', { statusCode: 404 });
    }

    const updated = await this.subscriptionRepo.update(subscription.id, tenantId, {
      stripeSubscriptionId,
      stripeCustomerId: stripeCustomerId ?? subscription.stripeCustomerId,
    });

    return updated;
  }

  async getSubscription(tenantId: string) {
    const subscription = await this.subscriptionRepo.findActiveByTenantId(tenantId);
    if (!subscription) {
      return null;
    }

    const plan = await this.planRepo.findById(subscription.planId);

    return {
      ...subscription,
      plan: plan ?? null,
    };
  }

  async checkFeatureAccess(tenantId: string, feature: string): Promise<boolean> {
    const subscription = await this.subscriptionRepo.findActiveByTenantId(tenantId);
    if (!subscription) {
      return false;
    }

    const plan = await this.planRepo.findById(subscription.planId);
    if (!plan) {
      return false;
    }

    const allowedFeatures = FEATURE_ACCESS[plan.slug] ?? [];
    return allowedFeatures.includes(feature);
  }
}
