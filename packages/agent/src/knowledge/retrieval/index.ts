import type { EmbeddingProvider, VectorizeClient } from '@ai-agent/providers';

export interface RetrievalConfig {
  topK: number;
  scoreThreshold: number;
  enableReranking: boolean;
}

export interface ChunkMetadata {
  documentId: string;
  knowledgeBaseId: string;
  sectionTitle?: string;
  pageNumber?: number;
  charStart: number;
  charEnd: number;
}

export interface RetrievalResult {
  chunkId: string;
  content: string;
  score: number;
  metadata: ChunkMetadata;
}

export interface KnowledgeContext {
  results: RetrievalResult[];
  query: string;
  durationMs: number;
  totalChunks: number;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface VectorIndex {
  search(params: {
    vector: number[];
    topK: number;
    filter?: Record<string, unknown>;
  }): Promise<VectorSearchResult[]>;

  upsert(params: {
    id: string;
    vector: number[];
    metadata: Record<string, unknown>;
  }): Promise<void>;

  delete(ids: string[]): Promise<void>;
}

export class InMemoryVectorIndex implements VectorIndex {
  private vectors: Map<
    string,
    { vector: number[]; metadata: Record<string, unknown> }
  > = new Map();

  async search(params: {
    vector: number[];
    topK: number;
    filter?: Record<string, unknown>;
  }): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    for (const [id, entry] of this.vectors) {
      if (params.filter && !this.matchesFilter(entry.metadata, params.filter)) {
        continue;
      }
      const score = cosineSimilarity(params.vector, entry.vector);
      results.push({ id, score, metadata: entry.metadata });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, params.topK);
  }

  async upsert(params: {
    id: string;
    vector: number[];
    metadata: Record<string, unknown>;
  }): Promise<void> {
    this.vectors.set(params.id, {
      vector: params.vector,
      metadata: params.metadata,
    });
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.vectors.delete(id);
    }
  }

  private matchesFilter(
    metadata: Record<string, unknown>,
    filter: Record<string, unknown>
  ): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === 'object' && value !== null && '$in' in value) {
        const allowed = (value as { $in: unknown[] }).$in;
        if (!allowed.includes(metadata[key])) return false;
      } else if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class VectorizeIndexAdapter implements VectorIndex {
  private client: VectorizeClient;
  private fallback: InMemoryVectorIndex;

  constructor(client: VectorizeClient) {
    this.client = client;
    this.fallback = new InMemoryVectorIndex();
  }

  async search(params: {
    vector: number[];
    topK: number;
    filter?: Record<string, unknown>;
  }): Promise<VectorSearchResult[]> {
    try {
      const results = await this.client.query({
        vector: params.vector,
        topK: params.topK,
        filter: params.filter,
        returnMetadata: true,
      });
      return results.map(r => ({
        id: r.id,
        score: r.score,
        metadata: (r.metadata as Record<string, unknown>) ?? {},
      }));
    } catch (err) {
      console.warn(
        '[Vectorize] Query failed, falling back to in-memory search:',
        err instanceof Error ? err.message : err
      );
      return this.fallback.search(params);
    }
  }

  async upsert(params: {
    id: string;
    vector: number[];
    metadata: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.client.upsert([
        {
          id: params.id,
          values: params.vector,
          metadata: params.metadata,
        },
      ]);
    } catch (err) {
      console.warn(
        '[Vectorize] Upsert failed, storing in-memory:',
        err instanceof Error ? err.message : err
      );
      await this.fallback.upsert(params);
    }
  }

  async delete(ids: string[]): Promise<void> {
    try {
      await this.client.delete(ids);
    } catch (err) {
      console.warn(
        '[Vectorize] Delete failed, removing from memory:',
        err instanceof Error ? err.message : err
      );
      await this.fallback.delete(ids);
    }
  }
}

export class KnowledgeEngine {
  private embeddingProvider: EmbeddingProvider;
  private vectorIndex: VectorIndex;

  constructor(embeddingProvider: EmbeddingProvider, vectorIndex: VectorIndex) {
    this.embeddingProvider = embeddingProvider;
    this.vectorIndex = vectorIndex;
  }

  static createWithVectorize(
    embeddingProvider: EmbeddingProvider,
    vectorizeClient: VectorizeClient
  ): KnowledgeEngine {
    return new KnowledgeEngine(
      embeddingProvider,
      new VectorizeIndexAdapter(vectorizeClient)
    );
  }

  async retrieve(
    query: string,
    knowledgeBaseIds: string[],
    config: RetrievalConfig,
    tenantId?: string
  ): Promise<KnowledgeContext> {
    const startTime = Date.now();

    const { embeddings } = await this.embeddingProvider.embed({
      texts: [query],
    });
    const queryEmbedding = embeddings[0];

    const filter: Record<string, unknown> = {
      knowledgeBaseId: { $in: knowledgeBaseIds },
    };
    if (tenantId) filter.tenantId = tenantId;

    const results = await this.vectorIndex.search({
      vector: queryEmbedding,
      topK: config.topK,
      filter,
    });

    const filteredResults = results.filter(r => r.score >= config.scoreThreshold);

    const durationMs = Date.now() - startTime;

    return {
      results: filteredResults.map(r => ({
        chunkId: r.id,
        content: r.metadata.content as string,
        score: r.score,
        metadata: r.metadata as unknown as ChunkMetadata,
      })),
      query,
      durationMs,
      totalChunks: filteredResults.length,
    };
  }

  async indexChunks(
    chunks: Array<{
      id: string;
      content: string;
      metadata: ChunkMetadata;
    }>
  ): Promise<void> {
    const texts = chunks.map(c => c.content);
    const { embeddings } = await this.embeddingProvider.embed({ texts });

    for (let i = 0; i < chunks.length; i++) {
      await this.vectorIndex.upsert({
        id: chunks[i].id,
        vector: embeddings[i],
        metadata: {
          ...chunks[i].metadata,
          content: chunks[i].content,
        },
      });
    }
  }
}
