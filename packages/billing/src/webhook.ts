import { SubscriptionRepository, InvoiceRepository } from '@ai-agent/database';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { AppError } from '@ai-agent/shared';

export interface RazorpayWebhookPayload {
  event: string;
  payload: {
    subscription?: {
      entity: {
        id: string;
        status: string;
        plan_id: string;
        customer_id?: string;
        current_start?: number;
        current_end?: number;
      };
    };
    payment?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        status: string;
      };
    };
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export class WebhookHandler {
  private subscriptionRepo: SubscriptionRepository;
  private invoiceRepo: InvoiceRepository;
  private webhookSecret: string;

  constructor(db: DrizzleD1Database, webhookSecret: string) {
    this.subscriptionRepo = new SubscriptionRepository(db as any);
    this.invoiceRepo = new InvoiceRepository(db as any);
    this.webhookSecret = webhookSecret;
  }

  async verifySignature(payloadStr: string, signature: string): Promise<boolean> {
    if (!signature || !this.webhookSecret) {
      return false;
    }

    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.webhookSecret);
    const msgData = encoder.encode(payloadStr);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const signatureArray = new Uint8Array(signatureBuffer);
    const computedSignature = Array.from(signatureArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return timingSafeEqual(computedSignature.toLowerCase(), signature.toLowerCase());
  }

  async handleRazorpayWebhook(eventData: RazorpayWebhookPayload): Promise<{ handled: boolean }> {
    const subEntity = eventData.payload.subscription?.entity;
    if (!subEntity) {
      return { handled: false };
    }

    const razorpaySubId = subEntity.id;

    switch (eventData.event) {
      case 'subscription.activated':
      case 'subscription.charged':
        await this.updateSubscriptionStatus(razorpaySubId, 'active', subEntity);
        return { handled: true };

      case 'subscription.pending':
        await this.updateSubscriptionStatus(razorpaySubId, 'past_due', subEntity);
        return { handled: true };

      case 'subscription.halted':
        await this.updateSubscriptionStatus(razorpaySubId, 'paused', subEntity);
        return { handled: true };

      case 'subscription.cancelled':
        await this.updateSubscriptionStatus(razorpaySubId, 'canceled', subEntity);
        return { handled: true };

      default:
        return { handled: false };
    }
  }

  private async updateSubscriptionStatus(
    razorpaySubId: string,
    status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused',
    entity: any
  ): Promise<void> {
    // Find subscription record matching this Razorpay/Stripe Subscription ID
    const sub = await (this.subscriptionRepo as any).findByExternalSubscriptionId(razorpaySubId);
    if (sub) {
      const updateData: any = { status };

      if (entity.current_start) {
        updateData.currentPeriodStart = new Date(entity.current_start * 1000);
      }
      if (entity.current_end) {
        updateData.currentPeriodEnd = new Date(entity.current_end * 1000);
      }

      await this.subscriptionRepo.update(sub.id, sub.tenantId, updateData);
    }
  }
}

