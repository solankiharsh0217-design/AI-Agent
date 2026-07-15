import { z } from 'zod';

export const ChunkingStrategy = z.enum(['recursive', 'semantic', 'markdown', 'code', 'fixed']);
export type ChunkingStrategy = z.infer<typeof ChunkingStrategy>;

export const ChunkingConfig = z.object({
  strategy: ChunkingStrategy.default('recursive'),
  chunkSize: z.number().int().positive().max(2000).default(500),
  chunkOverlap: z.number().int().nonnegative().default(50),
  separators: z.array(z.string()).default(['\n\n', '\n', '. ', ' ', '']),
  keepSeparator: z.boolean().default(true),
});
export type ChunkingConfig = z.infer<typeof ChunkingConfig>;

export const EmbeddingConfig = z.object({
  provider: z.string().default('workers-ai'),
  model: z.string().default('@cf/baai/bge-large-en-v1.5'),
  dimensions: z.number().int().positive().default(1024),
  batchSize: z.number().int().positive().default(32),
});
export type EmbeddingConfig = z.infer<typeof EmbeddingConfig>;

export const RetrievalConfig = z.object({
  topK: z.number().int().positive().default(5),
  scoreThreshold: z.number().min(0).max(1).default(0.7),
  enableReranking: z.boolean().default(false),
  metadataFilter: z.record(z.unknown()).default({}),
});
export type RetrievalConfig = z.infer<typeof RetrievalConfig>;

export const KnowledgeBaseConfig = z.object({
  chunking: ChunkingConfig.default({}),
  embedding: EmbeddingConfig.default({}),
  retrieval: RetrievalConfig.default({}),
});
export type KnowledgeBaseConfig = z.infer<typeof KnowledgeBaseConfig>;

export const KnowledgeBaseStatus = z.enum(['active', 'archived', 'processing', 'error']);
export type KnowledgeBaseStatus = z.infer<typeof KnowledgeBaseStatus>;

export const KnowledgeBase = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  config: KnowledgeBaseConfig.default({}),
  documentCount: z.number().int().nonnegative().default(0),
  chunkCount: z.number().int().nonnegative().default(0),
  totalSizeBytes: z.number().int().nonnegative().default(0),
  status: KnowledgeBaseStatus.default('active'),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});
export type KnowledgeBase = z.infer<typeof KnowledgeBase>;

export const DocumentSource = z.discriminatedUnion('type', [
  z.object({ type: z.literal('upload'), r2Key: z.string(), originalName: z.string() }),
  z.object({ type: z.literal('url'), url: z.string().url().refine(
    (url) => url.startsWith('http://') || url.startsWith('https://'),
    'URL must use http or https protocol'
  ), selector: z.string().nullable() }),
  z.object({ type: z.literal('text'), content: z.string() }),
]);
export type DocumentSource = z.infer<typeof DocumentSource>;

export const DocumentStatus = z.enum(['queued', 'downloading', 'parsing', 'chunking', 'embedding', 'indexing', 'completed', 'failed']);
export type DocumentStatus = z.infer<typeof DocumentStatus>;

export const Document = z.object({
  id: z.string().uuid(),
  knowledgeBaseId: z.string().uuid(),
  tenantId: z.string().uuid(),
  source: DocumentSource,
  filename: z.string().max(500),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
  status: DocumentStatus.default('queued'),
  processingError: z.string().nullable(),
  chunkCount: z.number().int().nonnegative().default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
  processedAt: z.date().nullable(),
});
export type Document = z.infer<typeof Document>;

export const Chunk = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  knowledgeBaseId: z.string().uuid(),
  tenantId: z.string().uuid(),
  index: z.number().int().nonnegative(),
  content: z.string(),
  tokenCount: z.number().int().positive(),
  metadata: z.object({
    sectionTitle: z.string().nullable(),
    pageNumber: z.number().int().positive().nullable(),
    charStart: z.number().int().nonnegative(),
    charEnd: z.number().int().nonnegative(),
  }).default({
    sectionTitle: null,
    pageNumber: null,
    charStart: 0,
    charEnd: 0,
  }),
  createdAt: z.date(),
});
export type Chunk = z.infer<typeof Chunk>;

export const RetrievalResult = z.object({
  chunk: Chunk,
  score: z.number().min(0).max(1),
});
export type RetrievalResult = z.infer<typeof RetrievalResult>;

export const RetrievalResponse = z.object({
  results: z.array(RetrievalResult),
  query: z.string(),
  durationMs: z.number().int().nonnegative(),
});
export type RetrievalResponse = z.infer<typeof RetrievalResponse>;
