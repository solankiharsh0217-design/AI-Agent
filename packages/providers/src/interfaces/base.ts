export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  lastChecked: Date;
  error?: string;
}

export interface ProviderConfig {
  apiKey?: string;
  accountId?: string;
  apiToken?: string;
  baseUrl?: string;
  timeout?: number;
  [key: string]: unknown;
}

export type ProviderType = 'llm' | 'stt' | 'tts' | 'embedding' | 'telephony';
