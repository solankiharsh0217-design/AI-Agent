import { eq, and, sql } from 'drizzle-orm';
import { analyticsEvents, usageRecords } from '@ai-agent/database';
import { createLogger, generateId } from '@ai-agent/shared';
import type { AnalyticsEvent } from '@ai-agent/types';

export class AnalyticsTracker {
  private logger;

  constructor(private db: any) {
    this.logger = createLogger({ module: 'analytics-tracker' });
  }

  async trackEvent(
    tenantId: string,
    event: string,
    data: {
      userId?: string;
      sessionId?: string;
      agentId?: string;
      conversationId?: string;
      channel?: string;
      properties?: Record<string, unknown>;
    } = {}
  ): Promise<AnalyticsEvent> {
    const id = generateId();
    const now = new Date();

    this.logger.info('Tracking analytics event', {
      tenantId,
      event,
      userId: data.userId,
      sessionId: data.sessionId,
      agentId: data.agentId,
      conversationId: data.conversationId,
      channel: data.channel,
    });

    await this.db.insert(analyticsEvents).values({
      id,
      tenantId,
      userId: data.userId ?? null,
      sessionId: data.sessionId ?? null,
      agentId: data.agentId ?? null,
      conversationId: data.conversationId ?? null,
      event,
      channel: data.channel ?? null,
      metadata: data.properties ?? {},
      createdAt: now,
    });

    return {
      id,
      tenantId,
      userId: data.userId ?? null,
      sessionId: data.sessionId ?? null,
      conversationId: data.conversationId ?? null,
      agentId: data.agentId ?? null,
      event,
      properties: data.properties ?? {},
      timestamp: now,
    };
  }

  async trackUsage(
    tenantId: string,
    agentId: string | undefined,
    event: string,
    quantity: number,
    cost: number = 0,
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    this.logger.info('Recording usage', {
      tenantId,
      agentId,
      event,
      quantity,
      cost,
    });

    const id = generateId();
    const now = new Date();

    await this.db.insert(usageRecords).values({
      id,
      tenantId,
      agentId: agentId ?? null,
      event,
      quantity,
      cost,
      metadata,
      createdAt: now,
    });

    return id;
  }

  async getUsageSummary(
    tenantId: string,
    agentId: string | undefined,
    period: { from: Date; to: Date }
  ) {
    const conditions = [eq(usageRecords.tenantId, tenantId)];
    if (agentId) conditions.push(eq(usageRecords.agentId, agentId));
    if (period.from) conditions.push(sql`${usageRecords.createdAt} >= ${period.from}`);
    if (period.to) conditions.push(sql`${usageRecords.createdAt} <= ${period.to}`);

    const rows = await this.db
      .select({
        event: usageRecords.event,
        totalQuantity: sql<number>`coalesce(sum(${usageRecords.quantity}), 0)`,
        totalCost: sql<number>`coalesce(sum(${usageRecords.cost}), 0)`,
      })
      .from(usageRecords)
      .where(and(...conditions))
      .groupBy(usageRecords.event);

    const totalQuantity = rows.reduce((sum: number, r: any) => sum + Number(r.totalQuantity), 0);
    const totalCost = rows.reduce((sum: number, r: any) => sum + Number(r.totalCost), 0);

    return {
      tenantId,
      agentId,
      period,
      events: rows,
      totals: { quantity: totalQuantity, cost: totalCost },
    };
  }
}
