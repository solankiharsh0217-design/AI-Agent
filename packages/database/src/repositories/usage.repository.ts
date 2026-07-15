import { eq, and, desc, sql } from 'drizzle-orm';
import { usageRecords } from '../schema/usage-records';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { generateId } from '../helpers';

export class UsageRepository {
  constructor(private db: DrizzleD1Database) {}

  async record(data: { tenantId: string; agentId?: string; conversationId?: string; event: string; provider?: string; quantity: number; cost: number; metadata?: Record<string, unknown> }) {
    const id = generateId();
    const now = new Date();
    await this.db.insert(usageRecords).values({
      id,
      tenantId: data.tenantId,
      agentId: data.agentId ?? null,
      conversationId: data.conversationId ?? null,
      event: data.event,
      provider: data.provider ?? null,
      quantity: data.quantity,
      cost: data.cost,
      metadata: data.metadata ?? {},
      createdAt: now,
    });
    return id;
  }

  async getUsageByTenant(tenantId: string, { from, to }: { from?: Date; to?: Date } = {}) {
    const conditions = [eq(usageRecords.tenantId, tenantId)];
    if (from) conditions.push(sql`${usageRecords.createdAt} >= ${from}`);
    if (to) conditions.push(sql`${usageRecords.createdAt} <= ${to}`);

    return this.db.select({
      event: usageRecords.event,
      totalQuantity: sql<number>`sum(${usageRecords.quantity})`,
      totalCost: sql<number>`sum(${usageRecords.cost})`,
    }).from(usageRecords)
      .where(and(...conditions))
      .groupBy(usageRecords.event);
  }

  async getUsageByAgent(agentId: string, tenantId: string, { from, to }: { from?: Date; to?: Date } = {}) {
    const conditions = [eq(usageRecords.agentId, agentId), eq(usageRecords.tenantId, tenantId)];
    if (from) conditions.push(sql`${usageRecords.createdAt} >= ${from}`);
    if (to) conditions.push(sql`${usageRecords.createdAt} <= ${to}`);

    return this.db.select({
      event: usageRecords.event,
      totalQuantity: sql<number>`sum(${usageRecords.quantity})`,
      totalCost: sql<number>`sum(${usageRecords.cost})`,
    }).from(usageRecords)
      .where(and(...conditions))
      .groupBy(usageRecords.event);
  }

  async getTotalCost(tenantId: string, { from, to }: { from?: Date; to?: Date } = {}) {
    const conditions = [eq(usageRecords.tenantId, tenantId)];
    if (from) conditions.push(sql`${usageRecords.createdAt} >= ${from}`);
    if (to) conditions.push(sql`${usageRecords.createdAt} <= ${to}`);

    const result = await this.db.select({
      totalCost: sql<number>`coalesce(sum(${usageRecords.cost}), 0)`,
    }).from(usageRecords).where(and(...conditions));
    return result[0]?.totalCost ?? 0;
  }
}
