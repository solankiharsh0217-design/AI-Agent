import { eq, and, sql } from 'drizzle-orm';
import { conversations, usageRecords, analyticsEvents } from '@ai-agent/database';
import { createLogger } from '@ai-agent/shared';
import type { DashboardMetrics } from '@ai-agent/types';

export class AnalyticsReporter {
  private logger;

  constructor(private db: any) {
    this.logger = createLogger({ module: 'analytics-reporter' });
  }

  async getDashboardStats(tenantId: string): Promise<DashboardMetrics> {
    this.logger.info('Fetching dashboard stats', { tenantId });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [convStats] = await this.db
      .select({
        totalConversations: sql<number>`count(*)`,
        totalMessages: sql<number>`coalesce(sum(${conversations.messageCount}), 0)`,
        totalTokens: sql<number>`coalesce(sum(${conversations.totalTokens}), 0)`,
        totalCost: sql<number>`coalesce(sum(${conversations.totalCostUsd}), 0)`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, tenantId),
          sql`${conversations.createdAt} >= ${thirtyDaysAgo}`
        )
      );

    const [activeConvs] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, tenantId),
          eq(conversations.status, 'active')
        )
      );

    // Response time isn't tracked in the schema, so return 0
    // TODO: Add responseTimeMs column to messages table
    const avgResponseTimeMs = 0;

    return {
      tenantId,
      period: {
        start: thirtyDaysAgo,
        end: now,
        interval: 'day',
      },
      activeConversations: activeConvs?.count ?? 0,
      totalConversations: convStats?.totalConversations ?? 0,
      totalMessages: convStats?.totalMessages ?? 0,
      totalTokens: convStats?.totalTokens ?? 0,
      totalCost: convStats?.totalCost ?? 0,
      avgResponseTimeMs: avgResponseTimeMs ?? 0,
      limits: null,
    };
  }

  async getAgentStats(
    tenantId: string,
    agentId: string,
    dateRange: { from: Date; to: Date }
  ) {
    this.logger.info('Fetching agent stats', { tenantId, agentId });

    const conditions = [
      eq(conversations.tenantId, tenantId),
      eq(conversations.agentId, agentId),
      sql`${conversations.createdAt} >= ${dateRange.from}`,
      sql`${conversations.createdAt} <= ${dateRange.to}`,
    ];

    const [convStats] = await this.db
      .select({
        totalConversations: sql<number>`count(*)`,
        totalMessages: sql<number>`coalesce(sum(${conversations.messageCount}), 0)`,
        totalTokens: sql<number>`coalesce(sum(${conversations.totalTokens}), 0)`,
        totalCost: sql<number>`coalesce(sum(${conversations.totalCostUsd}), 0)`,
      })
      .from(conversations)
      .where(and(...conditions));

    const usage = await this.db
      .select({
        event: usageRecords.event,
        totalQuantity: sql<number>`coalesce(sum(${usageRecords.quantity}), 0)`,
        totalCost: sql<number>`coalesce(sum(${usageRecords.cost}), 0)`,
      })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.tenantId, tenantId),
          eq(usageRecords.agentId, agentId),
          sql`${usageRecords.createdAt} >= ${dateRange.from}`,
          sql`${usageRecords.createdAt} <= ${dateRange.to}`
        )
      )
      .groupBy(usageRecords.event);

    const channels = await this.db
      .select({
        channel: conversations.channel,
        count: sql<number>`count(*)`,
      })
      .from(conversations)
      .where(and(...conditions))
      .groupBy(conversations.channel);

    return {
      tenantId,
      agentId,
      period: { start: dateRange.from, end: dateRange.to, interval: 'day' as const },
      totalConversations: convStats?.totalConversations ?? 0,
      totalMessages: convStats?.totalMessages ?? 0,
      totalTokens: convStats?.totalTokens ?? 0,
      totalCost: convStats?.totalCost ?? 0,
      usage,
      channels,
    };
  }

  async getChannelStats(
    tenantId: string,
    dateRange: { from: Date; to: Date }
  ) {
    this.logger.info('Fetching channel stats', { tenantId });

    const stats = await this.db
      .select({
        channel: conversations.channel,
        totalConversations: sql<number>`count(*)`,
        totalMessages: sql<number>`coalesce(sum(${conversations.messageCount}), 0)`,
        totalTokens: sql<number>`coalesce(sum(${conversations.totalTokens}), 0)`,
        totalCost: sql<number>`coalesce(sum(${conversations.totalCostUsd}), 0)`,
        avgMessagesPerConversation: sql<number>`coalesce(avg(${conversations.messageCount}), 0)`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, tenantId),
          sql`${conversations.createdAt} >= ${dateRange.from}`,
          sql`${conversations.createdAt} <= ${dateRange.to}`
        )
      )
      .groupBy(conversations.channel);

    const eventStats = await this.db
      .select({
        event: analyticsEvents.event,
        channel: analyticsEvents.channel,
        count: sql<number>`count(*)`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.tenantId, tenantId),
          sql`${analyticsEvents.createdAt} >= ${dateRange.from}`,
          sql`${analyticsEvents.createdAt} <= ${dateRange.to}`
        )
      )
      .groupBy(analyticsEvents.event, analyticsEvents.channel);

    return {
      tenantId,
      period: { start: dateRange.from, end: dateRange.to, interval: 'day' as const },
      channels: stats,
      events: eventStats,
    };
  }
}
