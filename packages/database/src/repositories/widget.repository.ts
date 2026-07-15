import { eq, and, isNull, desc } from 'drizzle-orm';
import { widgets } from '../schema/widgets';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { generateId } from '../helpers';

export class WidgetRepository {
  constructor(private db: DrizzleD1Database) {}

  async create(data: { tenantId: string; agentId: string; name: string; config?: Record<string, unknown>; domains?: string[] }) {
    const id = generateId();
    const now = new Date();
    await this.db.insert(widgets).values({
      id,
      tenantId: data.tenantId,
      agentId: data.agentId,
      name: data.name,
      config: data.config ?? {},
      domains: data.domains ?? [],
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(id, data.tenantId);
  }

  async findById(id: string, tenantId: string) {
    const row = await this.db.select().from(widgets).where(and(eq(widgets.id, id), eq(widgets.tenantId, tenantId), isNull(widgets.deletedAt)));
    return row[0] ?? null;
  }

  async findByIdUnscoped(id: string) {
    const row = await this.db.select().from(widgets).where(and(eq(widgets.id, id), isNull(widgets.deletedAt)));
    return row[0] ?? null;
  }

  async findByTenantId(tenantId: string) {
    return this.db.select().from(widgets)
      .where(and(eq(widgets.tenantId, tenantId), isNull(widgets.deletedAt)))
      .orderBy(desc(widgets.createdAt));
  }

  async findByAgentId(agentId: string, tenantId: string) {
    return this.db.select().from(widgets)
      .where(and(eq(widgets.agentId, agentId), eq(widgets.tenantId, tenantId), isNull(widgets.deletedAt)))
      .orderBy(desc(widgets.createdAt));
  }

  async update(id: string, tenantId: string, data: Partial<{ name: string; config: Record<string, unknown>; status: 'active' | 'inactive' | 'deleted'; domains: string[] }>) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.domains !== undefined) updateData.domains = data.domains;
    updateData.updatedAt = new Date();
    await this.db.update(widgets).set(updateData).where(and(eq(widgets.id, id), eq(widgets.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }

  async softDelete(id: string, tenantId: string) {
    await this.db.update(widgets).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(widgets.id, id), eq(widgets.tenantId, tenantId)));
  }
}
