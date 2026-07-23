import { Hono } from 'hono';
import { Env, AppVariables } from '../context';
import { SubscriptionManager } from '@ai-agent/billing';
import { InvoiceRepository, PlanRepository, SubscriptionRepository } from '@ai-agent/database';
import { UsageRepository } from '@ai-agent/database';
import { requirePermission } from '../middleware';

const billing = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// GET /api/v1/billing/subscription - Get active subscription state
billing.get('/subscription', async (c) => {
  const denied = requirePermission(c, 'manage:billing');
  if (denied) return denied;
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  const manager = new SubscriptionManager(db as any);
  const subscription = await manager.getSubscription(tenantId);

  return c.json({
    success: true,
    data: subscription,
  });
});

import { z } from 'zod';

const checkoutSchema = z.object({
  planSlug: z.string().min(1, 'planSlug is required'),
});

// POST /api/v1/billing/checkout - Create Razorpay subscription checkout
billing.post('/checkout', async (c) => {
  const denied = requirePermission(c, 'manage:billing');
  if (denied) return denied;
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = checkoutSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid request' } }, 400);
  }
  const planSlug = parsed.data.planSlug;

  const manager = new SubscriptionManager(db as any);
  const activeSub = await manager.getSubscription(tenantId);

  // If already subscribed, return it
  if (activeSub && activeSub.status === 'active') {
    return c.json({
      success: true,
      data: {
        subscriptionId: activeSub.stripeSubscriptionId,
        keyId: c.env.RAZORPAY_KEY_ID,
      },
    });
  }

  // Create temporary/trial subscription in DB
  const subscription = activeSub || (await manager.createSubscription(tenantId, planSlug));

  // Determine Razorpay Plan ID based on slug
  // For production, these are configured in the Razorpay Dashboard
  const planMapping: Record<string, string> = {
    free: 'plan_free_placeholder',
    starter: 'plan_starter_placeholder',
    pro: 'plan_pro_placeholder',
    enterprise: 'plan_enterprise_placeholder',
  };

  const razorpayPlanId = planMapping[planSlug];
  if (!razorpayPlanId) {
    return c.json({
      success: false,
      error: { code: 'INVALID_REQUEST', message: `Unknown plan slug: ${planSlug}`, requestId: c.get('requestId') },
    }, 400);
  }

  // If free plan, no Razorpay subscription is needed
  if (planSlug === 'free') {
    return c.json({
      success: true,
      data: {
        subscriptionId: 'free_tier',
        keyId: c.env.RAZORPAY_KEY_ID,
      },
    });
  }

  // Call Razorpay API to generate Subscription
  const basicAuth = btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`);
  const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      plan_id: razorpayPlanId,
      customer_notify: 1,
      total_count: 12, // 12 billing cycles (e.g. 1 year of monthly plans)
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    return c.json({
      success: false,
      error: {
        code: 'PAYMENT_GATEWAY_ERROR',
        message: `Failed to create subscription in Razorpay: ${errorBody}`,
      },
    }, 502);
  }

  const razorpaySub = (await response.json()) as { id: string; customer_id?: string };

  // Update subscription in database with Razorpay subscription ID
  await manager.updateSubscriptionPaymentDetails(
    tenantId,
    razorpaySub.id,
    razorpaySub.customer_id
  );

  return c.json({
    success: true,
    data: {
      subscriptionId: razorpaySub.id,
      keyId: c.env.RAZORPAY_KEY_ID,
    },
  });
});

// POST /api/v1/billing/webhook - Public Razorpay webhook
billing.post('/webhook', async (c) => {
  const signature = c.req.header('x-razorpay-signature');
  if (!signature) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing signature' } }, 401);
  }

  const rawBody = await c.req.text();
  const db = c.get('db');
  const { WebhookHandler } = await import('@ai-agent/billing');
  const handler = new WebhookHandler(db as any, c.env.RAZORPAY_WEBHOOK_SECRET);

  const verified = await handler.verifySignature(rawBody, signature);
  if (!verified) {
    return c.json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' } }, 401);
  }

  const eventData = JSON.parse(rawBody);
  const result = await handler.handleRazorpayWebhook(eventData);

  return c.json({ success: true, handled: result.handled });
});

// GET /billing/invoices - list invoices
billing.get('/invoices', async (c) => {
  const denied = requirePermission(c, 'manage:billing');
  if (denied) return denied;
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const repo = new InvoiceRepository(db as any);
  const invoices = await repo.findByTenantId(tenantId);
  return c.json({ success: true, data: invoices });
});

// GET /billing/usage - get usage summary
billing.get('/usage', async (c) => {
  const denied = requirePermission(c, 'manage:billing');
  if (denied) return denied;
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const repo = new UsageRepository(db as any);
  const usage = await repo.getUsageByTenant(tenantId);
  return c.json({ success: true, data: usage });
});

// GET /billing/plans - list available plans
billing.get('/plans', async (c) => {
  const denied = requirePermission(c, 'manage:billing');
  if (denied) return denied;
  const db = c.get('db');
  const repo = new PlanRepository(db as any);
  const plans = await repo.list();
  return c.json({ success: true, data: plans });
});

// DELETE /billing/subscription - cancel subscription
billing.delete('/subscription', async (c) => {
  const denied = requirePermission(c, 'manage:billing');
  if (denied) return denied;
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const manager = new SubscriptionManager(db as any, c.env.RAZORPAY_KEY_ID, c.env.RAZORPAY_KEY_SECRET);
  try {
    const canceled = await manager.cancelSubscription(tenantId);
    return c.json({ success: true, data: canceled });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'No active subscription' } }, 404);
    }
    throw error;
  }
});

// PATCH /billing/subscription - reactivate a canceled (cancel-at-period-end) subscription
billing.patch('/subscription', async (c) => {
  const denied = requirePermission(c, 'manage:billing');
  if (denied) return denied;
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const manager = new SubscriptionManager(db as any, c.env.RAZORPAY_KEY_ID, c.env.RAZORPAY_KEY_SECRET);
  try {
    const reactivated = await manager.reactivateSubscription(tenantId);
    return c.json({ success: true, data: reactivated });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'No subscription to reactivate' } }, 404);
    }
    throw error;
  }
});

export default billing;
