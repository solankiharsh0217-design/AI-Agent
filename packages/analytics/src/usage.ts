import { createLogger } from '@ai-agent/shared';
import { UsageRepository } from '@ai-agent/database';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model?: string;
}

export interface UsageCost {
  event: string;
  quantity: number;
  cost: number;
  provider?: string;
}

const PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  'llama-3.1-70b-versatile': { inputPerMillion: 0.59, outputPerMillion: 0.79 },
  'llama-3.1-8b-instant': { inputPerMillion: 0.05, outputPerMillion: 0.08 },
  'mixtral-8x7b-32768': { inputPerMillion: 0.24, outputPerMillion: 0.24 },
  'gemma-7b-it': { inputPerMillion: 0.05, outputPerMillion: 0.08 },
  'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10.0 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gpt-3.5-turbo': { inputPerMillion: 0.5, outputPerMillion: 1.5 },
  'claude-3-haiku': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  'claude-3-sonnet': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  'claude-3-5-sonnet': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  'claude-3-opus': { inputPerMillion: 15.0, outputPerMillion: 75.0 },
  'gemini-1.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.0 },
};

const STT_PRICING = { perSecond: 0.006 };
const TTS_PRICING = { perSecond: 0.03 };
const EMBEDDING_PRICING = { perToken: 0.0001 };
const STORAGE_PRICING = { perGB: 0.023 };

export class UsageTracker {
  private usageRepo: UsageRepository;
  private logger;

  constructor(private db: any) {
    this.usageRepo = new UsageRepository(db);
    this.logger = createLogger({ module: 'usage-tracker' });
  }

  async recordLLMUsage(
    tenantId: string,
    agentId: string | undefined,
    tokens: TokenUsage
  ): Promise<UsageCost> {
    const cost = this.calculateCost({
      event: 'llm_call',
      quantity: tokens.inputTokens + tokens.outputTokens,
      provider: tokens.model,
      metadata: {
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
      },
    });

    this.logger.info('Recording LLM usage', {
      tenantId,
      agentId,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      model: tokens.model,
      cost,
    });

    await this.usageRepo.record({
      tenantId,
      agentId,
      event: 'llm_call',
      provider: tokens.model,
      quantity: tokens.inputTokens + tokens.outputTokens,
      cost,
      metadata: {
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        model: tokens.model,
      },
    });

    return { event: 'llm_call', quantity: tokens.inputTokens + tokens.outputTokens, cost, provider: tokens.model };
  }

  async recordSTTUsage(
    tenantId: string,
    agentId: string | undefined,
    durationMs: number,
    provider: string = 'sarvam'
  ): Promise<UsageCost> {
    const durationSec = durationMs / 1000;
    const cost = this.calculateCost({
      event: 'stt',
      quantity: durationSec,
    });

    this.logger.info('Recording STT usage', {
      tenantId,
      agentId,
      durationMs,
      provider,
      cost,
    });

    await this.usageRepo.record({
      tenantId,
      agentId,
      event: 'stt',
      provider,
      quantity: durationSec,
      cost,
      metadata: { durationMs, provider },
    });

    return { event: 'stt', quantity: durationSec, cost, provider };
  }

  async recordTTSUsage(
    tenantId: string,
    agentId: string | undefined,
    durationMs: number,
    provider: string = 'sarvam'
  ): Promise<UsageCost> {
    const durationSec = durationMs / 1000;
    const cost = this.calculateCost({
      event: 'tts',
      quantity: durationSec,
    });

    this.logger.info('Recording TTS usage', {
      tenantId,
      agentId,
      durationMs,
      provider,
      cost,
    });

    await this.usageRepo.record({
      tenantId,
      agentId,
      event: 'tts',
      provider,
      quantity: durationSec,
      cost,
      metadata: { durationMs, provider },
    });

    return { event: 'tts', quantity: durationSec, cost, provider };
  }

  async recordEmbeddingUsage(
    tenantId: string,
    agentId: string | undefined,
    count: number,
    provider: string = 'workers-ai'
  ): Promise<UsageCost> {
    const cost = this.calculateCost({
      event: 'embedding',
      quantity: count,
    });

    this.logger.info('Recording embedding usage', {
      tenantId,
      agentId,
      count,
      provider,
      cost,
    });

    await this.usageRepo.record({
      tenantId,
      agentId,
      event: 'embedding',
      provider,
      quantity: count,
      cost,
      metadata: { count, provider },
    });

    return { event: 'embedding', quantity: count, cost, provider };
  }

  async recordStorageUsage(
    tenantId: string,
    bytes: number
  ): Promise<UsageCost> {
    const gb = bytes / (1024 * 1024 * 1024);
    const cost = this.calculateCost({
      event: 'storage',
      quantity: gb,
    });

    this.logger.info('Recording storage usage', {
      tenantId,
      bytes,
      cost,
    });

    await this.usageRepo.record({
      tenantId,
      event: 'storage',
      quantity: gb,
      cost,
      metadata: { bytes },
    });

    return { event: 'storage', quantity: gb, cost };
  }

  calculateCost(usage: { event: string; quantity: number; provider?: string; metadata?: Record<string, unknown> }): number {
    switch (usage.event) {
      case 'llm_call': {
        const pricing = PRICING[usage.provider ?? 'llama-3.1-70b-versatile'];
        if (!pricing) return 0;
        const inputTokens = (usage.metadata?.inputTokens as number) ?? 0;
        const outputTokens = (usage.metadata?.outputTokens as number) ?? 0;
        const inputCost = (inputTokens / 1_000_000) * (pricing.inputPerMillion ?? 0);
        const outputCost = (outputTokens / 1_000_000) * (pricing.outputPerMillion ?? pricing.inputPerMillion ?? 0);
        return inputCost + outputCost;
      }
      case 'stt':
        return usage.quantity * STT_PRICING.perSecond;
      case 'tts':
        return usage.quantity * TTS_PRICING.perSecond;
      case 'embedding':
        return usage.quantity * EMBEDDING_PRICING.perToken;
      case 'storage':
        return usage.quantity * STORAGE_PRICING.perGB;
      default:
        return 0;
    }
  }
}
