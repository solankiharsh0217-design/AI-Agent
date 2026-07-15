import { eq, and, isNull, desc } from 'drizzle-orm';
import { agents } from '../schema/agents';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { generateId } from '../helpers';

export class AgentRepository {
  constructor(private db: DrizzleD1Database) {}

  async create(data: { tenantId: string; name: string; description?: string; config: Record<string, unknown> }) {
    const id = generateId();
    const now = new Date();
    await this.db.insert(agents).values({
      id,
      tenantId: data.tenantId,
      name: data.name,
      description: data.description ?? null,
      config: data.config,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(id, data.tenantId);
  }

  async findById(id: string, tenantId: string) {
    const row = await this.db.select().from(agents).where(and(eq(agents.id, id), eq(agents.tenantId, tenantId), isNull(agents.deletedAt)));
    return row[0] ?? null;
  }

  async findByTenantId(tenantId: string) {
    return this.db.select().from(agents)
      .where(and(eq(agents.tenantId, tenantId), isNull(agents.deletedAt)))
      .orderBy(desc(agents.createdAt));
  }

  async update(id: string, tenantId: string, data: Partial<{ name: string; description: string; config: Record<string, unknown>; status: 'draft' | 'published' | 'archived' | 'deleted'; version: number; publishedVersion: number }>) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.version !== undefined) updateData.version = data.version;
    if (data.publishedVersion !== undefined) updateData.publishedVersion = data.publishedVersion;
    updateData.updatedAt = new Date();
    await this.db.update(agents).set(updateData).where(and(eq(agents.id, id), eq(agents.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }

  async softDelete(id: string, tenantId: string) {
    await this.db.update(agents).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(agents.id, id), eq(agents.tenantId, tenantId)));
  }

  async publish(id: string, tenantId: string) {
    const agent = await this.findById(id, tenantId);
    if (!agent) throw new Error('Agent not found');
    const newVersion = agent.version + 1;
    await this.db.update(agents).set({
      status: 'published' as const,
      version: newVersion,
      publishedVersion: newVersion,
      updatedAt: new Date(),
    }).where(and(eq(agents.id, id), eq(agents.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }

  async archive(id: string, tenantId: string) {
    await this.db.update(agents).set({ status: 'archived' as const, updatedAt: new Date() }).where(and(eq(agents.id, id), eq(agents.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }
}
