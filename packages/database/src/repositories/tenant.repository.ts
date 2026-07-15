import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { tenants } from '../schema/tenants';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { generateId } from '../helpers';

export class TenantRepository {
  constructor(private db: DrizzleD1Database) {}

  async create(data: { name: string; slug: string; ownerId?: string }) {
    const id = generateId();
    const now = new Date();
    await this.db.insert(tenants).values({
      id,
      name: data.name,
      slug: data.slug,
      ownerId: data.ownerId ?? null,
      settings: {
        features: { voiceEnabled: true, phoneEnabled: false, apiEnabled: false, whatsappEnabled: false, slackEnabled: false },
        limits: { maxAgents: 10, maxKnowledgeBases: 5, maxDocumentsPerKb: 100, maxMonthlyMessages: 10000, maxMonthlyVoiceMinutes: 100, maxMonthlyPhoneMinutes: 0, maxStorageMb: 1000, maxVectorDimensions: 1536 },
      },
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(id);
  }

  async findById(id: string) {
    const row = await this.db.select().from(tenants).where(and(eq(tenants.id, id), isNull(tenants.deletedAt)));
    return row[0] ?? null;
  }

  async findBySlug(slug: string) {
    const row = await this.db.select().from(tenants).where(and(eq(tenants.slug, slug), isNull(tenants.deletedAt)));
    return row[0] ?? null;
  }

  async update(id: string, data: Partial<{ name: string; slug: string; status: 'active' | 'suspended' | 'deleted'; settings: string }>) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.settings !== undefined) updateData.settings = data.settings;
    updateData.updatedAt = new Date();
    await this.db.update(tenants).set(updateData).where(eq(tenants.id, id));
    return this.findById(id);
  }

  async softDelete(id: string) {
    await this.db.update(tenants).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(tenants.id, id));
  }

  async list({ page = 1, limit = 20, sortOrder = 'desc' as const } = {}) {
    const offset = (page - 1) * limit;
    const orderFn = sortOrder === 'desc' ? desc : asc;

    const rows = await this.db.select().from(tenants)
      .where(isNull(tenants.deletedAt))
      .orderBy(orderFn(tenants.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await this.db.select({ count: sql<number>`count(*)` }).from(tenants).where(isNull(tenants.deletedAt));
    const total = countResult[0]?.count ?? 0;

    return { data: rows, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
