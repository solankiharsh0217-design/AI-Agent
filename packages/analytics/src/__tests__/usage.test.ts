import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsageTracker } from '../usage';

const mockRecord = vi.fn().mockResolvedValue({ id: 'record-1' });

vi.mock('@ai-agent/database', () => ({
  UsageRepository: vi.fn().mockImplementation(() => ({
    record: mockRecord,
  })),
}));

describe('UsageTracker', () => {
  let tracker: UsageTracker;
  const mockDb = {};

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new UsageTracker(mockDb);
  });

  describe('calculateCost', () => {
    it('should calculate LLM cost based on known model pricing', () => {
      const cost = tracker.calculateCost({
        event: 'llm_call',
        quantity: 1500,
        provider: 'gpt-4o',
        metadata: { inputTokens: 1000, outputTokens: 500 },
      });
      expect(cost).toBeGreaterThan(0);
    });

    it('should return 0 for unknown model', () => {
      const cost = tracker.calculateCost({
        event: 'llm_call',
        quantity: 1500,
        provider: 'unknown-model',
        metadata: { inputTokens: 1000, outputTokens: 500 },
      });
      expect(cost).toBe(0);
    });

    it('should calculate STT cost based on seconds', () => {
      const cost = tracker.calculateCost({ event: 'stt', quantity: 60 });
      expect(cost).toBe(0.36);
    });

    it('should calculate TTS cost based on seconds', () => {
      const cost = tracker.calculateCost({ event: 'tts', quantity: 60 });
      expect(cost).toBe(1.8);
    });

    it('should calculate embedding cost based on tokens', () => {
      const cost = tracker.calculateCost({ event: 'embedding', quantity: 10000 });
      expect(cost).toBe(1);
    });

    it('should calculate storage cost based on GB', () => {
      const cost = tracker.calculateCost({ event: 'storage', quantity: 1 });
      expect(cost).toBe(0.02);
    });

    it('should round to 2 decimal places', () => {
      const cost = tracker.calculateCost({ event: 'stt', quantity: 1 });
      expect(cost).toBe(0.01);
    });
  });

  describe('recordLLMUsage', () => {
    it('should record LLM usage with correct cost', async () => {
      const result = await tracker.recordLLMUsage('tenant-1', 'agent-1', {
        inputTokens: 100000,
        outputTokens: 50000,
        model: 'gpt-4o-mini',
      });
      expect(result.event).toBe('llm_call');
      expect(result.quantity).toBe(150000);
      expect(result.cost).toBe(0.05);
      expect(mockRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          agentId: 'agent-1',
          event: 'llm_call',
          quantity: 150000,
        })
      );
    });

    it('should work without agentId', async () => {
      const result = await tracker.recordLLMUsage('tenant-1', undefined, {
        inputTokens: 100,
        outputTokens: 50,
      });
      expect(result.event).toBe('llm_call');
      expect(mockRecord).toHaveBeenCalled();
    });
  });

  describe('recordSTTUsage', () => {
    it('should record STT usage based on duration', async () => {
      const result = await tracker.recordSTTUsage('tenant-1', 'agent-1', 30000);
      expect(result.event).toBe('stt');
      expect(result.quantity).toBe(30);
      expect(mockRecord).toHaveBeenCalled();
    });
  });

  describe('recordTTSUsage', () => {
    it('should record TTS usage', async () => {
      const result = await tracker.recordTTSUsage('tenant-1', 'agent-1', 60000);
      expect(result.event).toBe('tts');
      expect(result.quantity).toBe(60);
      expect(mockRecord).toHaveBeenCalled();
    });
  });

  describe('recordEmbeddingUsage', () => {
    it('should record embedding usage', async () => {
      const result = await tracker.recordEmbeddingUsage('tenant-1', 'agent-1', 5000);
      expect(result.event).toBe('embedding');
      expect(result.quantity).toBe(5000);
      expect(mockRecord).toHaveBeenCalled();
    });
  });

  describe('recordStorageUsage', () => {
    it('should record storage usage based on bytes', async () => {
      const result = await tracker.recordStorageUsage('tenant-1', 1073741824);
      expect(result.event).toBe('storage');
      expect(result.quantity).toBeCloseTo(1, 1);
      expect(mockRecord).toHaveBeenCalled();
    });
  });
});
