import { createDatabase, DocumentRepository, KnowledgeBaseRepository, type Database } from '@ai-agent/database';
import { WorkersAIEmbeddingProvider } from '@ai-agent/providers';
import { Logger } from '@ai-agent/shared';

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  ENVIRONMENT: string;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
}

interface IngestionMessage {
  action?: 'ingest' | 'delete';
  documentId: string;
  knowledgeBaseId: string;
  tenantId: string;
  r2Key: string;
  metadata?: Record<string, unknown>;
}

interface ParsedContent {
  text: string;
  metadata: Record<string, unknown>;
}

const logger = new Logger({ service: 'ingestion-worker' });

function extractPdfText(buffer: Uint8Array): string {
  const decoder = new TextDecoder('latin1');
  const text = decoder.decode(buffer);

  // Detect encrypted PDFs
  if (/\/Encrypt\s+\d+\s+\d+\s+R/i.test(text)) {
    throw new Error('PDF is encrypted - text extraction not supported');
  }

  const collected: string[] = [];

  // Try to decompress and extract text from FlateDecode streams
  const streamRegex = /stream\s([\s\S]*?)\nendstream/g;
  let streamMatch: RegExpExecArray | null;
  while ((streamMatch = streamRegex.exec(text)) !== null) {
    const raw = streamMatch[1].trim();
    if (!raw) continue;
    try {
      const rawBytes = new TextEncoder().encode(raw);
      const decompressed = new DecompressionStream('deflate-raw');
      const blob = new Blob([rawBytes]);
      const decompressedStream = blob.stream().pipeThrough(decompressed);
      // We can't use ReadableStream in all Workers contexts, so fall through
    } catch {
      // Decompression not available, continue with raw extraction below
    }
  }

  // Extract text from uncompressed content streams (BT...ET blocks)
  const btRegex = /BT\s([\s\S]*?)ET/g;
  let match: RegExpExecArray | null;

  while ((match = btRegex.exec(text)) !== null) {
    const stream = match[1];

    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(stream)) !== null) {
      collected.push(tjMatch[1]);
    }

    const tjBracketRegex = /\[([^\]]*)\]\s*TJ/g;
    let tjBracketMatch: RegExpExecArray | null;
    while ((tjBracketMatch = tjBracketRegex.exec(stream)) !== null) {
      const inner = tjBracketMatch[1];
      const strRegex = /\(([^)]*)\)/g;
      let strMatch: RegExpExecArray | null;
      while ((strMatch = strRegex.exec(inner)) !== null) {
        collected.push(strMatch[1]);
      }
    }
  }

  return collected
    .join(' ')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\\\/g, '\\')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCsv(text: string): string {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return '';

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return headers.map((h, i) => `${h}: ${values[i] ?? ''}`).join('\n');
  });

  return `Data from CSV:\n\n${rows.join('\n---\n')}`;
}

function parseJson(text: string): string {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // If it's not valid JSON, return raw text truncated
    return text.substring(0, 10000);
  }
}

async function parseDocument(r2: R2Bucket, r2Key: string, mimeType: string): Promise<ParsedContent> {
  const object = await r2.get(r2Key);
  if (!object) throw new Error(`File not found in R2: ${r2Key}`);

  const buffer = await object.arrayBuffer();
  const text = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false }).decode(buffer);

  // Basic text extraction - in production, use proper parsers
  switch (mimeType) {
    case 'text/plain':
    case 'text/markdown':
      return { text, metadata: { format: 'text' } };

    case 'text/html':
      // Simple HTML tag removal - in production use a proper HTML parser
      const cleaned = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return { text: cleaned, metadata: { format: 'html' } };

    case 'application/pdf':
      try {
        const pdfText = extractPdfText(new Uint8Array(buffer));
        if (pdfText) {
          return { text: pdfText, metadata: { format: 'pdf' } };
        }
        logger.warn('PDF text extraction returned empty, falling back to raw decode', { r2Key });
        return { text: text.substring(0, 10000), metadata: { format: 'pdf', partial: true } };
      } catch (err) {
        logger.warn('PDF text extraction failed', { r2Key, error: (err as Error).message });
        throw err;
      }

    case 'text/csv':
      return { text: parseCsv(text), metadata: { format: 'csv' } };

    case 'application/json':
      return { text: parseJson(text), metadata: { format: 'json' } };

    default:
      return { text: text.substring(0, 10000), metadata: { format: 'unknown', mimeType } };
  }
}

function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  // Cap overlap at 25% of chunk size
  const overlapWords = Math.min(overlap, Math.floor(chunkSize / 4));

  for (let i = 0; i < words.length; i += chunkSize - overlapWords) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) chunks.push(chunk);
  }

  return chunks;
}

async function processDocument(
  env: Env,
  message: IngestionMessage
): Promise<void> {
  if (!message.documentId || !message.action) {
    console.error('Invalid message: missing documentId or action');
    return;
  }

  if (!message.tenantId) {
    console.error('Invalid message: missing tenantId');
    return;
  }

  if (!message.knowledgeBaseId) {
    console.error('Invalid message: missing knowledgeBaseId');
    return;
  }

  const db = createDatabase(env.DB) as unknown as Database;
  const docRepo = new DocumentRepository(db as any);
  const kbRepo = new KnowledgeBaseRepository(db as any);

  logger.info('Processing document', {
    documentId: message.documentId,
    knowledgeBaseId: message.knowledgeBaseId,
  });

  // Update status to parsing
  await docRepo.updateStatus(message.documentId, message.tenantId, 'parsing');

  try {
    // 1. Get document info
    const doc = await docRepo.findById(message.documentId, message.tenantId);
    if (!doc) throw new Error('Document not found');

    const source = doc.source as { type: string; r2Key: string };
    const mimeType = doc.mimeType;

    // 2. Parse document
    const parsed = await parseDocument(env.R2, source.r2Key, mimeType);

    // 3. Chunk text
    await docRepo.updateStatus(message.documentId, message.tenantId, 'chunking');
    const chunks = chunkText(parsed.text);
    logger.info('Document chunked', { documentId: message.documentId, chunkCount: chunks.length });

    // 4. Generate embeddings
    await docRepo.updateStatus(message.documentId, message.tenantId, 'embedding');
    const embeddingProvider = new WorkersAIEmbeddingProvider({
      accountId: env.CF_ACCOUNT_ID,
      apiToken: env.CF_API_TOKEN,
    });

    // Process in batches
    const batchSize = 32;
    const embeddingChunks: Array<{ content: string; embedding: number[] }> = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const { embeddings } = await embeddingProvider.embed({ texts: batch });

      for (let j = 0; j < batch.length; j++) {
        embeddingChunks.push({
          content: batch[j],
          embedding: embeddings[j],
        });
      }
    }

    // 5. Store chunks in Vectorize (if available) or D1
    await docRepo.updateStatus(message.documentId, message.tenantId, 'indexing');

    // Store chunk metadata in D1 for reference
    // In a real implementation, you'd also store embeddings in Vectorize
    const { chunks: chunksTable } = await import('@ai-agent/database').then(m => ({ chunks: m.chunks }));
    const { generateId } = await import('@ai-agent/database').then(m => ({ generateId: () => crypto.randomUUID() }));

    // Batch insert chunks (D1 supports up to 100 rows per batch)
    const BATCH_SIZE = 100;
    const chunksToInsert = embeddingChunks.map((chunk, i) => ({
      id: generateId(),
      documentId: message.documentId,
      knowledgeBaseId: message.knowledgeBaseId,
      tenantId: message.tenantId,
      index: i,
      content: chunk.content,
      tokenCount: Math.ceil(chunk.content.length / 4),
      metadata: {},
      createdAt: new Date(),
    }));

    for (let i = 0; i < chunksToInsert.length; i += BATCH_SIZE) {
      const batch = chunksToInsert.slice(i, i + BATCH_SIZE);
      await (db as any).insert(chunksTable).values(batch);
    }

    // Store embeddings in Vectorize in batches
    const vectorizeBatchSize = 100;
    for (let i = 0; i < embeddingChunks.length; i += vectorizeBatchSize) {
      const batch = embeddingChunks.slice(i, i + vectorizeBatchSize);
      const vectorizeRecords = batch.map((chunk, j) => ({
        id: chunksToInsert[i + j].id,
        values: chunk.embedding,
        namespace: `${message.tenantId}:${message.knowledgeBaseId}`,
        metadata: {
          documentId: message.documentId,
          knowledgeBaseId: message.knowledgeBaseId,
          content: chunk.content,
        },
      }));
      await env.VECTORIZE.upsert(vectorizeRecords);
    }

    logger.debug('Stored chunks', {
      documentId: message.documentId,
      chunkCount: embeddingChunks.length,
    });

    // 6. Update document status
    await docRepo.updateStatus(message.documentId, message.tenantId, 'completed');
    await docRepo.updateChunkCount(message.documentId, message.tenantId, embeddingChunks.length);

    // 7. Update knowledge base stats
    await kbRepo.incrementChunkCount(message.knowledgeBaseId, embeddingChunks.length, message.tenantId);

    logger.info('Document processed successfully', {
      documentId: message.documentId,
      chunkCount: embeddingChunks.length,
    });
  } catch (error) {
    logger.error('Document processing failed', error as Error, {
      documentId: message.documentId,
    });

    await docRepo.updateStatus(
      message.documentId,
      message.tenantId,
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    );

    throw error;
  }
}

async function deleteDocument(env: Env, message: IngestionMessage): Promise<void> {
  if (!message.documentId || !message.tenantId) {
    console.error('Invalid delete message: missing documentId or tenantId');
    return;
  }

  if (!message.knowledgeBaseId) {
    console.error('Invalid delete message: missing knowledgeBaseId');
    return;
  }

  const db = createDatabase(env.DB) as unknown as Database;
  const docRepo = new DocumentRepository(db as any);
  const kbRepo = new KnowledgeBaseRepository(db as any);

  logger.info('Deleting document resources', {
    documentId: message.documentId,
    knowledgeBaseId: message.knowledgeBaseId,
  });

  try {
    // Fetch document to get size for totalSizeBytes decrement
    const docRecord = await docRepo.findById(message.documentId, message.tenantId);
    const docSize = (docRecord?.sizeBytes as number) ?? 0;

    const { chunks: chunksTable } = await import('@ai-agent/database').then(m => ({ chunks: m.chunks }));
    const { eq } = await import('drizzle-orm');

    // 1. Fetch chunks to get IDs for Vectorize deletion
    const existingChunks = await (db as any).select({ id: chunksTable.id }).from(chunksTable).where(eq(chunksTable.documentId, message.documentId));
    
    // 2. Delete embeddings from Vectorize in batches
    const chunkIds = existingChunks.map((c: { id: string }) => c.id);
    if (chunkIds.length > 0) {
      const batchSize = 1000;
      for (let i = 0; i < chunkIds.length; i += batchSize) {
        await env.VECTORIZE.deleteByIds(chunkIds.slice(i, i + batchSize));
      }
    }

    // 3. Delete chunks from D1
    await (db as any).delete(chunksTable).where(eq(chunksTable.documentId, message.documentId));

    // 4. Delete file from R2
    if (message.r2Key) {
      await env.R2.delete(message.r2Key);
    }

    // 5. Update KB stats
    await kbRepo.decrementChunkCount(message.knowledgeBaseId, chunkIds.length, message.tenantId);
    await kbRepo.decrementDocumentCount(message.knowledgeBaseId, message.tenantId);
    if (docSize > 0) await kbRepo.decrementTotalSize(message.knowledgeBaseId, docSize, message.tenantId);

    // 6. Delete document record
    await docRepo.delete(message.documentId, message.tenantId);

    logger.info('Document deleted successfully', {
      documentId: message.documentId,
      deletedChunks: chunkIds.length,
    });
  } catch (error) {
    logger.error('Document deletion failed', error as Error, {
      documentId: message.documentId,
    });
    throw error;
  }
}

export default {
  async queue(batch: MessageBatch<IngestionMessage>, env: Env): Promise<void> {
    logger.info('Processing batch', { batchSize: batch.messages.length });

    for (const message of batch.messages) {
      try {
        if (message.body.action === 'delete') {
          await deleteDocument(env, message.body);
        } else {
          await processDocument(env, message.body);
        }
        message.ack();
      } catch (error) {
        const maxRetries = 3;
        const retryCount = message.attempts ?? 0;

        if (retryCount > maxRetries) {
          const db = createDatabase(env.DB) as unknown as Database;
          const docRepo = new DocumentRepository(db as any);
          await docRepo.updateStatus(message.body.documentId, message.body.tenantId, 'failed', 'Max retries exceeded');
          message.ack();
          continue;
        }

        logger.error('Failed to process message', error as Error, {
          documentId: message.body.documentId,
          action: message.body.action,
        });
        message.retry();
      }
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response('Ingestion Worker', { status: 200 });
  },
};
