import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { knowledgeBases } from '../schema/knowledge-bases';
import { documents } from '../schema/documents';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { generateId } from '../helpers';

export class KnowledgeBaseRepository {
  constructor(private db: DrizzleD1Database) {}

  async create(data: { tenantId: string; name: string; description?: string; config?: Record<string, unknown> }) {
    const id = generateId();
    const now = new Date();
    await this.db.insert(knowledgeBases).values({
      id,
      tenantId: data.tenantId,
      name: data.name,
      description: data.description ?? null,
      config: data.config ?? {},
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(id, data.tenantId);
  }

  async findById(id: string, tenantId: string) {
    const row = await this.db.select().from(knowledgeBases).where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.tenantId, tenantId), isNull(knowledgeBases.deletedAt)));
    return row[0] ?? null;
  }

  async findByTenantId(tenantId: string) {
    return this.db.select().from(knowledgeBases)
      .where(and(eq(knowledgeBases.tenantId, tenantId), isNull(knowledgeBases.deletedAt)))
      .orderBy(desc(knowledgeBases.createdAt));
  }

  async update(id: string, tenantId: string, data: Partial<{ name: string; description: string; config: string; status: 'active' | 'archived' | 'processing' | 'error'; documentCount: number; chunkCount: number; totalSizeBytes: number }>) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.documentCount !== undefined) updateData.documentCount = data.documentCount;
    if (data.chunkCount !== undefined) updateData.chunkCount = data.chunkCount;
    if (data.totalSizeBytes !== undefined) updateData.totalSizeBytes = data.totalSizeBytes;
    updateData.updatedAt = new Date();
    await this.db.update(knowledgeBases).set(updateData).where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }

  async softDelete(id: string, tenantId: string) {
    await this.db.update(knowledgeBases).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.tenantId, tenantId)));
  }

  async incrementDocumentCount(id: string, tenantId: string) {
    await this.db.update(knowledgeBases).set({
      documentCount: sql`${knowledgeBases.documentCount} + 1`,
      updatedAt: new Date(),
    }).where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.tenantId, tenantId)));
  }

  async decrementDocumentCount(id: string, tenantId: string) {
    await this.db.update(knowledgeBases).set({
      documentCount: sql`MAX(0, ${knowledgeBases.documentCount} - 1)`,
      updatedAt: new Date(),
    }).where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.tenantId, tenantId)));
  }

  async incrementChunkCount(id: string, count: number, tenantId: string) {
    await this.db.update(knowledgeBases).set({
      chunkCount: sql`${knowledgeBases.chunkCount} + ${count}`,
      updatedAt: new Date(),
    }).where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.tenantId, tenantId)));
  }

  async decrementChunkCount(id: string, count: number, tenantId: string) {
    await this.db.update(knowledgeBases).set({
      chunkCount: sql`MAX(0, ${knowledgeBases.chunkCount} - ${count})`,
      updatedAt: new Date(),
    }).where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.tenantId, tenantId)));
  }
}
