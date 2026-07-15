import type { EmbeddingProvider, EmbeddingRequest, EmbeddingResponse } from '../../interfaces/embedding';
import { fetchWithRetry } from '../../fetch-retry';

export interface WorkersAIConfig {
  accountId: string;
  apiToken: string;
  baseUrl?: string;
  timeout?: number;
}

export class WorkersAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'workers-ai';
  private accountId: string;
  private apiToken: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: WorkersAIConfig) {
    this.accountId = config.accountId;
    this.apiToken = config.apiToken;
    this.baseUrl = config.baseUrl ?? `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run`;
    this.timeout = config.timeout ?? 30000;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const model = request.model ?? '@cf/baai/bge-large-en-v1.5';

    const response = await fetchWithRetry(`${this.baseUrl}/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: request.texts,
      }),
    }, { maxRetries: 3, timeoutMs: this.timeout });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Workers AI error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    if (!data.success) {
      throw new Error(`Workers AI error: ${data.errors?.join(', ') ?? 'Unknown error'}`);
    }

    const embeddings = data.result?.data ?? data.result ?? [];
    const dimensions = Array.isArray(embeddings[0]) ? embeddings[0].length : 1024;

    return {
      embeddings,
      model,
      dimensions,
    };
  }
}
