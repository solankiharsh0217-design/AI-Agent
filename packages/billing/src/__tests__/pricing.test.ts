import { describe, it, expect, beforeEach } from 'vitest';
import { PricingEngine } from '../pricing';

describe('PricingEngine', () => {
  let engine: PricingEngine;

  beforeEach(() => {
    engine = new PricingEngine();
  });

  describe('getPlanLimits', () => {
    it('should return limits for the free plan', () => {
      const limits = engine.getPlanLimits('free');
      expect(limits.maxAgents).toBe(1);
      expect(limits.maxKnowledgeBases).toBe(1);
      expect(limits.maxMonthlyMessages).toBe(1000);
      expect(limits.maxStorageMb).toBe(500);
    });

    it('should return limits for the pro plan', () => {
      const limits = engine.getPlanLimits('pro');
      expect(limits.maxAgents).toBe(25);
      expect(limits.maxMonthlyMessages).toBe(50000);
    });

    it('should throw for unknown plan', () => {
      expect(() => engine.getPlanLimits('nonexistent')).toThrow('Plan not found');
    });
  });

  describe('getPlanPricing', () => {
    it('should return pricing for starter plan', () => {
      const pricing = engine.getPlanPricing('starter');
      expect(pricing.basePrice).toBe(29);
      expect(pricing.currency).toBe('USD');
      expect(pricing.interval).toBe('month');
      expect(pricing.usageRates).toHaveLength(8);
    });

    it('should include usage rates for all plans', () => {
      for (const slug of ['free', 'starter', 'pro', 'enterprise']) {
        const pricing = engine.getPlanPricing(slug);
        expect(pricing.usageRates.length).toBeGreaterThan(0);
        expect(pricing.usageRates[0].metric).toBeTruthy();
        expect(pricing.usageRates[0].pricePerUnit).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('calculateInvoice', () => {
    it('should compute zero overage for free plan within limits', () => {
      const result = engine.calculateInvoice('free', [
        { metric: 'tokens_input', quantity: 30000 },
        { metric: 'voice_minutes_stt', quantity: 15 },
      ]);
      expect(result.basePrice).toBe(0);
      expect(result.subtotal).toBe(0);
      expect(result.total).toBe(0);
      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems[0].amount).toBe(0);
    });

    it('should compute overage for usage beyond included units', () => {
      const result = engine.calculateInvoice('free', [
        { metric: 'tokens_input', quantity: 100000 }, // 50k included, 50k overage
      ]);
      expect(result.subtotal).toBe(0); // price per unit is 0 for free
      expect(result.total).toBe(0);
    });

    it('should compute positive overage cost for paid plans', () => {
      const result = engine.calculateInvoice('starter', [
        { metric: 'tokens_input', quantity: 600000 }, // 500k included, 100k overage
      ]);
      const expectedOverage = 100000 * 0.000001;
      expect(result.subtotal).toBe(0.1);
      expect(result.total).toBe(29.1);
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].amount).toBe(0.1);
    });

    it('should handle multiple metrics with mixed overage', () => {
      const result = engine.calculateInvoice('pro', [
        { metric: 'tokens_input', quantity: 3000000 }, // 2M included, 1M overage
        { metric: 'voice_minutes_stt', quantity: 300 }, // 500 included, 0 overage
      ]);
      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems[0].amount).toBeGreaterThan(0);
      expect(result.lineItems[1].amount).toBe(0);
      const expectedCost = 1000000 * 0.0000008;
      expect(result.subtotal).toBe(0.8);
      expect(result.total).toBe(99.8);
    });

    it('should round to 2 decimal places', () => {
      const result = engine.calculateInvoice('starter', [
        { metric: 'tokens_input', quantity: 500001 }, // 1 token overage
      ]);
      expect(result.subtotal).toBe(0);
      expect(result.total).toBe(29);
    });
  });

  describe('listPlans', () => {
    it('should return all 4 plans', () => {
      const plans = engine.listPlans();
      expect(plans).toHaveLength(4);
      const slugs = plans.map(p => p.slug);
      expect(slugs).toContain('free');
      expect(slugs).toContain('starter');
      expect(slugs).toContain('pro');
      expect(slugs).toContain('enterprise');
    });
  });
});
