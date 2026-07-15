import { eq, and, isNull, desc } from 'drizzle-orm';
import { documents } from '../schema/documents';
import { chunks } from '../schema/chunks';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { generateId } from '../helpers';

export class DocumentRepository {
  constructor(private db: DrizzleD1Database) {}

  async create(data: { knowledgeBaseId: string; tenantId: string; source: Record<string, unknown>; filename: string; mimeType: string; sizeBytes: number }) {
    const id = generateId();
    const now = new Date();
    await this.db.insert(documents).values({
      id,
      knowledgeBaseId: data.knowledgeBaseId,
      tenantId: data.tenantId,
      source: data.source,
      filename: data.filename,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(id, data.tenantId);
  }

  async findById(id: string, tenantId: string) {
    const row = await this.db.select().from(documents).where(and(eq(documents.id, id), eq(documents.tenantId, tenantId), isNull(documents.deletedAt)));
    return row[0] ?? null;
  }

  async findByKnowledgeBaseId(knowledgeBaseId: string, tenantId: string) {
    return this.db.select().from(documents)
      .where(and(eq(documents.knowledgeBaseId, knowledgeBaseId), eq(documents.tenantId, tenantId), isNull(documents.deletedAt)))
      .orderBy(desc(documents.createdAt));
  }

  async findByTenantId(tenantId: string) {
    return this.db.select().from(documents)
      .where(and(eq(documents.tenantId, tenantId), isNull(documents.deletedAt)))
      .orderBy(desc(documents.createdAt));
  }

  async updateStatus(id: string, tenantId: string, status: 'queued' | 'downloading' | 'parsing' | 'chunking' | 'embedding' | 'indexing' | 'completed' | 'failed', error?: string) {
    const update: Record<string, unknown> = { status, updatedAt: new Date() };
    if (error) update.processingError = error;
    if (status === 'completed') update.processedAt = new Date();
    await this.db.update(documents).set(update).where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }

  async updateChunkCount(id: string, tenantId: string, chunkCount: number) {
    await this.db.update(documents).set({ chunkCount, updatedAt: new Date() }).where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)));
  }

  async delete(id: string, tenantId: string) {
    await this.db.transaction(async (tx) => {
      await tx.delete(chunks).where(eq(chunks.documentId, id));
      await tx.update(documents).set({ deletedAt: new Date() }).where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)));
    });
  }
}
