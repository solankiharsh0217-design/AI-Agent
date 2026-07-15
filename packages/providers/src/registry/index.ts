import type { LLMProvider } from '../interfaces/llm';
import type { STTProvider } from '../interfaces/stt';
import type { TTSProvider } from '../interfaces/tts';
import type { EmbeddingProvider } from '../interfaces/embedding';
import type { TwilioProvider, PhoneNumbersProvider } from '../interfaces/telephony';
import type { ProviderHealth } from '../interfaces/base';
import { generateId } from '../helpers';

export interface ProviderRegistryConfig {
  llm?: { default: string; providers: Record<string, LLMProvider> };
  stt?: { default: string; providers: Record<string, STTProvider> };
  tts?: { default: string; providers: Record<string, TTSProvider> };
  embedding?: { default: string; providers: Record<string, EmbeddingProvider> };
  telephony?: { default: string; providers: Record<string, TwilioProvider & Partial<PhoneNumbersProvider>> };
}

export class ProviderRegistry {
  private llmProviders: Map<string, LLMProvider> = new Map();
  private sttProviders: Map<string, STTProvider> = new Map();
  private ttsProviders: Map<string, TTSProvider> = new Map();
  private embeddingProviders: Map<string, EmbeddingProvider> = new Map();
  private telephonyProviders: Map<string, TwilioProvider & Partial<PhoneNumbersProvider>> = new Map();
  private healthCache: Map<string, ProviderHealth> = new Map();

  private defaultLLM: string = 'groq';
  private defaultSTT: string = 'sarvam';
  private defaultTTS: string = 'sarvam';
  private defaultEmbedding: string = 'workers-ai';
  private defaultTelephony: string = 'twilio';

  constructor(config?: ProviderRegistryConfig) {
    if (config?.llm) {
      this.defaultLLM = config.llm.default;
      for (const [name, provider] of Object.entries(config.llm.providers)) {
        this.llmProviders.set(name, provider);
      }
    }
    if (config?.stt) {
      this.defaultSTT = config.stt.default;
      for (const [name, provider] of Object.entries(config.stt.providers)) {
        this.sttProviders.set(name, provider);
      }
    }
    if (config?.tts) {
      this.defaultTTS = config.tts.default;
      for (const [name, provider] of Object.entries(config.tts.providers)) {
        this.ttsProviders.set(name, provider);
      }
    }
    if (config?.embedding) {
      this.defaultEmbedding = config.embedding.default;
      for (const [name, provider] of Object.entries(config.embedding.providers)) {
        this.embeddingProviders.set(name, provider);
      }
    }
    if (config?.telephony) {
      this.defaultTelephony = config.telephony.default;
      for (const [name, provider] of Object.entries(config.telephony.providers)) {
        this.telephonyProviders.set(name, provider);
      }
    }
  }

  async init(config: ProviderRegistryConfig) {
    if (config.llm) {
      this.defaultLLM = config.llm.default;
      for (const [name, provider] of Object.entries(config.llm.providers)) {
        this.llmProviders.set(name, provider);
      }
    }
    if (config.stt) {
      this.defaultSTT = config.stt.default;
      for (const [name, provider] of Object.entries(config.stt.providers)) {
        this.sttProviders.set(name, provider);
      }
    }
    if (config.tts) {
      this.defaultTTS = config.tts.default;
      for (const [name, provider] of Object.entries(config.tts.providers)) {
        this.ttsProviders.set(name, provider);
      }
    }
    if (config.embedding) {
      this.defaultEmbedding = config.embedding.default;
      for (const [name, provider] of Object.entries(config.embedding.providers)) {
        this.embeddingProviders.set(name, provider);
      }
    }
    if (config.telephony) {
      this.defaultTelephony = config.telephony.default;
      for (const [name, provider] of Object.entries(config.telephony.providers)) {
        this.telephonyProviders.set(name, provider);
      }
    }
  }

  registerLLM(name: string, provider: LLMProvider) {
    this.llmProviders.set(name, provider);
  }

  registerSTT(name: string, provider: STTProvider) {
    this.sttProviders.set(name, provider);
  }

  registerTTS(name: string, provider: TTSProvider) {
    this.ttsProviders.set(name, provider);
  }

  registerEmbedding(name: string, provider: EmbeddingProvider) {
    this.embeddingProviders.set(name, provider);
  }

  registerTelephony(name: string, provider: TwilioProvider & Partial<PhoneNumbersProvider>) {
    this.telephonyProviders.set(name, provider);
  }

  getLLM(name?: string): LLMProvider {
    const providerName = name ?? this.defaultLLM;
    const provider = this.llmProviders.get(providerName);
    if (!provider) throw new Error(`LLM provider '${providerName}' not found`);
    return provider;
  }

  getSTT(name?: string): STTProvider {
    const providerName = name ?? this.defaultSTT;
    const provider = this.sttProviders.get(providerName);
    if (!provider) throw new Error(`STT provider '${providerName}' not found`);
    return provider;
  }

  getTTS(name?: string): TTSProvider {
    const providerName = name ?? this.defaultTTS;
    const provider = this.ttsProviders.get(providerName);
    if (!provider) throw new Error(`TTS provider '${providerName}' not found`);
    return provider;
  }

  getEmbedding(name?: string): EmbeddingProvider {
    const providerName = name ?? this.defaultEmbedding;
    const provider = this.embeddingProviders.get(providerName);
    if (!provider) throw new Error(`Embedding provider '${providerName}' not found`);
    return provider;
  }

  getTelephony(name?: string): TwilioProvider & Partial<PhoneNumbersProvider> {
    const providerName = name ?? this.defaultTelephony;
    const provider = this.telephonyProviders.get(providerName);
    if (!provider) throw new Error(`Telephony provider '${providerName}' not found`);
    return provider;
  }

  async checkHealth(name: string, type: 'llm' | 'stt' | 'tts' | 'embedding' | 'telephony'): Promise<ProviderHealth> {
    const cacheKey = `${type}:${name}`;
    const cached = this.healthCache.get(cacheKey);
    if (cached && Date.now() - cached.lastChecked.getTime() < 30000) {
      return cached;
    }

    const start = Date.now();
    try {
      let provider: unknown;
      switch (type) {
        case 'llm': provider = this.llmProviders.get(name); break;
        case 'stt': provider = this.sttProviders.get(name); break;
        case 'tts': provider = this.ttsProviders.get(name); break;
        case 'embedding': provider = this.embeddingProviders.get(name); break;
        case 'telephony': provider = this.telephonyProviders.get(name); break;
      }

      if (!provider) {
        const health: ProviderHealth = { status: 'down', latencyMs: 0, lastChecked: new Date(), error: 'Provider not found' };
        this.healthCache.set(cacheKey, health);
        return health;
      }

      // Actual health check — test the provider by verifying it is properly initialized
      let healthy = true;
      let errorMsg: string | undefined;

      try {
        if (type === 'llm' && 'complete' in (provider as any)) {
          const p = provider as LLMProvider;
          if (!p.name || p.name.length === 0) { healthy = false; errorMsg = 'Provider not properly initialized'; }
        } else if (type === 'stt' && 'transcribe' in (provider as any)) {
          const p = provider as STTProvider;
          if (!p.name || p.name.length === 0) { healthy = false; errorMsg = 'Provider not properly initialized'; }
        } else if (type === 'tts' && 'synthesize' in (provider as any)) {
          const p = provider as TTSProvider;
          if (!p.name || p.name.length === 0) { healthy = false; errorMsg = 'Provider not properly initialized'; }
        } else if (type === 'embedding' && 'embed' in (provider as any)) {
          const p = provider as EmbeddingProvider;
          if (!p.name || p.name.length === 0) { healthy = false; errorMsg = 'Provider not properly initialized'; }
        } else if (type === 'telephony') {
          if (!(provider as any).name || (provider as any).name.length === 0) { healthy = false; errorMsg = 'Provider not properly initialized'; }
        }
      } catch (err) {
        healthy = false;
        errorMsg = err instanceof Error ? err.message : 'Health check failed';
      }

      const health: ProviderHealth = {
        status: healthy ? 'healthy' : 'degraded',
        latencyMs: Date.now() - start,
        lastChecked: new Date(),
        ...(errorMsg ? { error: errorMsg } : {}),
      };
      this.healthCache.set(cacheKey, health);
      return health;
    } catch (error) {
      const health: ProviderHealth = {
        status: 'down',
        latencyMs: Date.now() - start,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      this.healthCache.set(cacheKey, health);
      return health;
    }
  }

  async checkAllHealth(): Promise<Record<string, ProviderHealth>> {
    const results: Record<string, ProviderHealth> = {};
    for (const name of this.llmProviders.keys()) {
      results[`llm:${name}`] = await this.checkHealth(name, 'llm');
    }
    for (const name of this.sttProviders.keys()) {
      results[`stt:${name}`] = await this.checkHealth(name, 'stt');
    }
    for (const name of this.ttsProviders.keys()) {
      results[`tts:${name}`] = await this.checkHealth(name, 'tts');
    }
    for (const name of this.embeddingProviders.keys()) {
      results[`embedding:${name}`] = await this.checkHealth(name, 'embedding');
    }
    for (const name of this.telephonyProviders.keys()) {
      results[`telephony:${name}`] = await this.checkHealth(name, 'telephony');
    }
    return results;
  }
}
