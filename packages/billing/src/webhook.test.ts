import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookHandler, RazorpayWebhookPayload } from './webhook';

describe('WebhookHandler - Razorpay Signature Verification', () => {
  const secret = 'test_webhook_secret';
  let mockDB: any;
  let mockSubscriptionRepo: any;

  beforeEach(() => {
    mockSubscriptionRepo = {
      findByExternalSubscriptionId: vi.fn(),
      update: vi.fn(),
    };
    mockDB = {};
  });

  it('should successfully verify a correct Razorpay signature', async () => {
    const handler = new WebhookHandler(mockDB, secret);
    const payload = JSON.stringify({ event: 'test.event', payload: {} });

    // Manually compute HMAC-SHA256 hex signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const msgData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const expectedSig = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const verified = await handler.verifySignature(payload, expectedSig);
    expect(verified).toBe(true);
  });

  it('should fail verification if the signature is invalid or payload is altered', async () => {
    const handler = new WebhookHandler(mockDB, secret);
    const payload = JSON.stringify({ event: 'test.event', payload: {} });
    const invalidSig = 'a'.repeat(64);

    const verified = await handler.verifySignature(payload, invalidSig);
    expect(verified).toBe(false);
  });
});

describe('WebhookHandler - Webhook Event Handling', () => {
  let mockDB: any;
  let mockSubscriptionRepo: any;
  const secret = 'secret';

  beforeEach(() => {
    mockSubscriptionRepo = {
      findByExternalSubscriptionId: vi.fn().mockResolvedValue({ id: 'sub-123', status: 'trialing' }),
      update: vi.fn().mockResolvedValue(null),
    };
    mockDB = {};
  });

  it('should update subscription status to active on subscription.activated', async () => {
    const handler = new WebhookHandler(mockDB, secret);
    (handler as any).subscriptionRepo = mockSubscriptionRepo;

    const eventPayload: RazorpayWebhookPayload = {
      event: 'subscription.activated',
      payload: {
        subscription: {
          entity: {
            id: 'sub_razorpay_123',
            status: 'activated',
            plan_id: 'plan_starter',
            current_start: 1715525555,
            current_end: 1718117555,
          },
        },
      },
    };

    const res = await handler.handleRazorpayWebhook(eventPayload);
    expect(res.handled).toBe(true);
    expect(mockSubscriptionRepo.findByExternalSubscriptionId).toHaveBeenCalledWith('sub_razorpay_123');
    expect(mockSubscriptionRepo.update).toHaveBeenCalledWith('sub-123', undefined, {
      status: 'active',
      currentPeriodStart: expect.any(Date),
      currentPeriodEnd: expect.any(Date),
    });
  });

  it('should update subscription status to paused on subscription.halted', async () => {
    const handler = new WebhookHandler(mockDB, secret);
    (handler as any).subscriptionRepo = mockSubscriptionRepo;

    const eventPayload: RazorpayWebhookPayload = {
      event: 'subscription.halted',
      payload: {
        subscription: {
          entity: {
            id: 'sub_razorpay_123',
            status: 'halted',
            plan_id: 'plan_starter',
          },
        },
      },
    };

    const res = await handler.handleRazorpayWebhook(eventPayload);
    expect(res.handled).toBe(true);
    expect(mockSubscriptionRepo.update).toHaveBeenCalledWith('sub-123', undefined, {
      status: 'paused',
    });
  });

  it('should update subscription status to canceled on subscription.cancelled', async () => {
    const handler = new WebhookHandler(mockDB, secret);
    (handler as any).subscriptionRepo = mockSubscriptionRepo;

    const eventPayload: RazorpayWebhookPayload = {
      event: 'subscription.cancelled',
      payload: {
        subscription: {
          entity: {
            id: 'sub_razorpay_123',
            status: 'cancelled',
            plan_id: 'plan_starter',
          },
        },
      },
    };

    const res = await handler.handleRazorpayWebhook(eventPayload);
    expect(res.handled).toBe(true);
    expect(mockSubscriptionRepo.update).toHaveBeenCalledWith('sub-123', undefined, {
      status: 'canceled',
    });
  });
});
