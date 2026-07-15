export interface VectorizeConfig {
  accountId: string;
  apiToken: string;
  indexName: string;
  baseUrl?: string;
  timeout?: number;
}

export interface VectorizeUpsertVector {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}

export interface VectorizeQueryParams {
  vector: number[];
  topK: number;
  filter?: Record<string, unknown>;
  returnValues?: boolean;
  returnMetadata?: boolean;
}

export interface VectorizeQueryResult {
  id: string;
  score: number;
  values?: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorizeIndexConfig {
  dimensions: number;
  metric: 'cosine' | 'euclidean' | 'dot-product';
}

export interface VectorizeIndexInfo {
  name: string;
  config: VectorizeIndexConfig;
  vectorsCount: number;
}

import { fetchWithRetry } from '../fetch-retry';

export class VectorizeClient {
  private accountId: string;
  private apiToken: string;
  private indexName: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: VectorizeConfig) {
    this.accountId = config.accountId;
    this.apiToken = config.apiToken;
    this.indexName = config.indexName;
    this.baseUrl =
      config.baseUrl ??
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/vectorize/indexes/${config.indexName}`;
    this.timeout = config.timeout ?? 30000;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: this.headers,
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetchWithRetry(url, init);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Vectorize API error (${method} ${path}): ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as {
      success: boolean;
      errors: string[];
      result: T;
    };

    if (!data.success) {
      const errorDetail = data.errors?.join(', ') ?? 'Unknown error';
      throw new Error(
        `Vectorize API error (${method} ${path}): ${response.status} - ${errorDetail}`
      );
    }

    return data.result;
  }

  async upsert(vectors: VectorizeUpsertVector[]): Promise<{ count: number }> {
    if (vectors.length === 0) {
      return { count: 0 };
    }
    return this.request<{ count: number }>('/vectors', 'POST', { vectors });
  }

  async query(params: VectorizeQueryParams): Promise<VectorizeQueryResult[]> {
    return this.request<VectorizeQueryResult[]>('/query', 'POST', {
      vector: params.vector,
      topK: params.topK,
      filter: params.filter,
      returnValues: params.returnValues ?? false,
      returnMetadata: params.returnMetadata ?? true,
    });
  }

  async delete(ids: string[]): Promise<{ count: number }> {
    if (ids.length === 0) {
      return { count: 0 };
    }
    return this.request<{ count: number }>('/vectors', 'DELETE', { ids });
  }

  async fetch(ids: string[]): Promise<VectorizeUpsertVector[]> {
    const encodedIds = ids.map(id => encodeURIComponent(id)).join(',');
    return this.request<VectorizeUpsertVector[]>(
      `/vectors?ids=${encodedIds}`,
      'GET'
    );
  }

  async describe(): Promise<VectorizeIndexInfo> {
    return this.request<VectorizeIndexInfo>('', 'GET');
  }

  async info(): Promise<VectorizeIndexInfo> {
    return this.describe();
  }
}
