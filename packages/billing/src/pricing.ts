import type { BillingMetric, PlanPricing, PlanLimits } from '@ai-agent/types';

export interface InvoiceLineItemInput {
  metric: BillingMetric;
  quantity: number;
}

interface PlanConfig {
  slug: string;
  name: string;
  basePrice: number;
  usageRates: { metric: BillingMetric; pricePerUnit: number; unit: string; includedUnits: number }[];
  limits: PlanLimits;
}

const PLANS: Record<string, PlanConfig> = {
  free: {
    slug: 'free',
    name: 'Free',
    basePrice: 0,
    usageRates: [
      { metric: 'tokens_input', pricePerUnit: 0, unit: 'tokens', includedUnits: 50000 },
      { metric: 'tokens_output', pricePerUnit: 0, unit: 'tokens', includedUnits: 25000 },
      { metric: 'voice_minutes_stt', pricePerUnit: 0, unit: 'minutes', includedUnits: 30 },
      { metric: 'voice_minutes_tts', pricePerUnit: 0, unit: 'minutes', includedUnits: 30 },
      { metric: 'vector_dimensions', pricePerUnit: 0, unit: 'dimensions', includedUnits: 100000 },
      { metric: 'storage_mb', pricePerUnit: 0, unit: 'MB', includedUnits: 500 },
      { metric: 'phone_minutes_inbound', pricePerUnit: 0, unit: 'minutes', includedUnits: 0 },
      { metric: 'phone_minutes_outbound', pricePerUnit: 0, unit: 'minutes', includedUnits: 0 },
    ],
    limits: {
      maxAgents: 1,
      maxKnowledgeBases: 1,
      maxDocumentsPerKb: 25,
      maxMonthlyMessages: 1000,
      maxMonthlyVoiceMinutes: 30,
      maxMonthlyPhoneMinutes: 0,
      maxStorageMb: 500,
    },
  },
  starter: {
    slug: 'starter',
    name: 'Starter',
    basePrice: 29,
    usageRates: [
      { metric: 'tokens_input', pricePerUnit: 0.000001, unit: 'tokens', includedUnits: 500000 },
      { metric: 'tokens_output', pricePerUnit: 0.000002, unit: 'tokens', includedUnits: 250000 },
      { metric: 'voice_minutes_stt', pricePerUnit: 0.02, unit: 'minutes', includedUnits: 100 },
      { metric: 'voice_minutes_tts', pricePerUnit: 0.03, unit: 'minutes', includedUnits: 100 },
      { metric: 'vector_dimensions', pricePerUnit: 0.00001, unit: 'dimensions', includedUnits: 1000000 },
      { metric: 'storage_mb', pricePerUnit: 0.01, unit: 'MB', includedUnits: 5000 },
      { metric: 'phone_minutes_inbound', pricePerUnit: 0.015, unit: 'minutes', includedUnits: 100 },
      { metric: 'phone_minutes_outbound', pricePerUnit: 0.02, unit: 'minutes', includedUnits: 100 },
    ],
    limits: {
      maxAgents: 5,
      maxKnowledgeBases: 5,
      maxDocumentsPerKb: 100,
      maxMonthlyMessages: 10000,
      maxMonthlyVoiceMinutes: 200,
      maxMonthlyPhoneMinutes: 200,
      maxStorageMb: 5000,
    },
  },
  pro: {
    slug: 'pro',
    name: 'Pro',
    basePrice: 99,
    usageRates: [
      { metric: 'tokens_input', pricePerUnit: 0.0000008, unit: 'tokens', includedUnits: 2000000 },
      { metric: 'tokens_output', pricePerUnit: 0.0000015, unit: 'tokens', includedUnits: 1000000 },
      { metric: 'voice_minutes_stt', pricePerUnit: 0.015, unit: 'minutes', includedUnits: 500 },
      { metric: 'voice_minutes_tts', pricePerUnit: 0.025, unit: 'minutes', includedUnits: 500 },
      { metric: 'vector_dimensions', pricePerUnit: 0.000008, unit: 'dimensions', includedUnits: 5000000 },
      { metric: 'storage_mb', pricePerUnit: 0.008, unit: 'MB', includedUnits: 25000 },
      { metric: 'phone_minutes_inbound', pricePerUnit: 0.012, unit: 'minutes', includedUnits: 500 },
      { metric: 'phone_minutes_outbound', pricePerUnit: 0.018, unit: 'minutes', includedUnits: 500 },
    ],
    limits: {
      maxAgents: 25,
      maxKnowledgeBases: 20,
      maxDocumentsPerKb: 500,
      maxMonthlyMessages: 50000,
      maxMonthlyVoiceMinutes: 1000,
      maxMonthlyPhoneMinutes: 1000,
      maxStorageMb: 25000,
    },
  },
  enterprise: {
    slug: 'enterprise',
    name: 'Enterprise',
    basePrice: 499,
    usageRates: [
      { metric: 'tokens_input', pricePerUnit: 0.0000005, unit: 'tokens', includedUnits: 10000000 },
      { metric: 'tokens_output', pricePerUnit: 0.000001, unit: 'tokens', includedUnits: 5000000 },
      { metric: 'voice_minutes_stt', pricePerUnit: 0.01, unit: 'minutes', includedUnits: 2000 },
      { metric: 'voice_minutes_tts', pricePerUnit: 0.02, unit: 'minutes', includedUnits: 2000 },
      { metric: 'vector_dimensions', pricePerUnit: 0.000005, unit: 'dimensions', includedUnits: 20000000 },
      { metric: 'storage_mb', pricePerUnit: 0.005, unit: 'MB', includedUnits: 100000 },
      { metric: 'phone_minutes_inbound', pricePerUnit: 0.01, unit: 'minutes', includedUnits: 2000 },
      { metric: 'phone_minutes_outbound', pricePerUnit: 0.015, unit: 'minutes', includedUnits: 2000 },
    ],
    limits: {
      maxAgents: 100,
      maxKnowledgeBases: 100,
      maxDocumentsPerKb: 2000,
      maxMonthlyMessages: 500000,
      maxMonthlyVoiceMinutes: 10000,
      maxMonthlyPhoneMinutes: 10000,
      maxStorageMb: 100000,
    },
  },
};

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export class PricingEngine {
  private plans: Record<string, PlanConfig>;

  constructor(plans?: Record<string, PlanConfig>) {
    this.plans = plans ?? PLANS;
  }

  getPlanLimits(slug: string): PlanLimits {
    const plan = this.plans[slug];
    if (!plan) {
      throw new Error(`Plan not found: ${slug}`);
    }
    return plan.limits;
  }

  getPlanPricing(slug: string): PlanPricing {
    const plan = this.plans[slug];
    if (!plan) {
      throw new Error(`Plan not found: ${slug}`);
    }
    return {
      basePrice: plan.basePrice,
      currency: 'USD',
      interval: 'month',
      usageRates: plan.usageRates,
    };
  }

  calculateInvoice(slug: string, usage: InvoiceLineItemInput[]): { lineItems: { description: string; quantity: number; unitPrice: number; amount: number; metric: BillingMetric }[]; subtotal: number; basePrice: number; total: number } {
    const plan = this.plans[slug];
    if (!plan) {
      throw new Error(`Plan not found: ${slug}`);
    }

    const lineItems: { description: string; quantity: number; unitPrice: number; amount: number; metric: BillingMetric }[] = [];
    let subtotal = 0;

    for (const item of usage) {
      const rate = plan.usageRates.find((r) => r.metric === item.metric);
      if (!rate) continue;

      const overage = Math.max(0, item.quantity - rate.includedUnits);
      const amount = roundCents(overage * rate.pricePerUnit);
      subtotal = roundCents(subtotal + amount);

      lineItems.push({
        description: `${rate.unit} overage (${rate.includedUnits} included)`,
        quantity: overage,
        unitPrice: rate.pricePerUnit,
        amount,
        metric: item.metric,
      });
    }

    const basePrice = plan.basePrice;
    const total = roundCents(basePrice + subtotal);

    return { lineItems, subtotal, basePrice, total };
  }

  listPlans(): { slug: string; name: string; basePrice: number }[] {
    return Object.values(this.plans).map((p) => ({
      slug: p.slug,
      name: p.name,
      basePrice: p.basePrice,
    }));
  }
}
