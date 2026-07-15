import { z } from 'zod';

export const AnalyticsEvent = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  sessionId: z.string().uuid().nullable(),
  conversationId: z.string().uuid().nullable(),
  agentId: z.string().uuid().nullable(),
  event: z.string(),
  properties: z.record(z.unknown()).default({}),
  timestamp: z.date(),
});
export type AnalyticsEvent = z.infer<typeof AnalyticsEvent>;

export const AnalyticsPeriod = z.object({
  start: z.date(),
  end: z.date(),
  interval: z.enum(['hour', 'day', 'week', 'month']).default('day'),
});
export type AnalyticsPeriod = z.infer<typeof AnalyticsPeriod>;

export const ConversationAnalytics = z.object({
  tenantId: z.string().uuid(),
  period: AnalyticsPeriod,
  totalConversations: z.number().int().nonnegative(),
  totalMessages: z.number().int().nonnegative(),
  avgMessagesPerConversation: z.number().nonnegative(),
  conversationsByChannel: z.record(z.number().int().nonnegative()),
  conversationsByAgent: z.record(z.number().int().nonnegative()),
  uniqueUsers: z.number().int().nonnegative(),
});
export type ConversationAnalytics = z.infer<typeof ConversationAnalytics>;

export const TokenUsageAnalytics = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  estimatedCost: z.number().nonnegative(),
});
export type TokenUsageAnalytics = z.infer<typeof TokenUsageAnalytics>;

export const MessageAnalytics = z.object({
  tenantId: z.string().uuid(),
  period: AnalyticsPeriod,
  totalMessages: z.number().int().nonnegative(),
  avgResponseTimeMs: z.number().nonnegative(),
  totalTokens: TokenUsageAnalytics,
  tokensByModel: z.record(TokenUsageAnalytics).default({}),
});
export type MessageAnalytics = z.infer<typeof MessageAnalytics>;

export const VoiceAnalytics = z.object({
  tenantId: z.string().uuid(),
  period: AnalyticsPeriod,
  totalSessions: z.number().int().nonnegative(),
  totalMinutes: z.number().nonnegative(),
  avgSessionDuration: z.number().nonnegative(),
  avgLatencyMs: z.number().nonnegative(),
});
export type VoiceAnalytics = z.infer<typeof VoiceAnalytics>;

export const PhoneAnalytics = z.object({
  tenantId: z.string().uuid(),
  period: AnalyticsPeriod,
  totalCalls: z.number().int().nonnegative(),
  inboundCalls: z.number().int().nonnegative(),
  outboundCalls: z.number().int().nonnegative(),
  totalMinutes: z.number().nonnegative(),
  avgCallDuration: z.number().nonnegative(),
});
export type PhoneAnalytics = z.infer<typeof PhoneAnalytics>;

export const LimitUsage = z.object({
  agents: z.object({ used: z.number().int().nonnegative(), limit: z.number().int().nonnegative() }).nullable(),
  knowledgeBases: z.object({ used: z.number().int().nonnegative(), limit: z.number().int().nonnegative() }).nullable(),
  monthlyMessages: z.object({ used: z.number().int().nonnegative(), limit: z.number().int().nonnegative() }).nullable(),
  monthlyVoiceMinutes: z.object({ used: z.number().nonnegative(), limit: z.number().nonnegative() }).nullable(),
  storageMb: z.object({ used: z.number().nonnegative(), limit: z.number().nonnegative() }).nullable(),
});
export type LimitUsage = z.infer<typeof LimitUsage>;

export const DashboardMetrics = z.object({
  tenantId: z.string().uuid(),
  period: AnalyticsPeriod,
  activeConversations: z.number().int().nonnegative(),
  totalConversations: z.number().int().nonnegative(),
  totalMessages: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  totalCost: z.number().nonnegative(),
  avgResponseTimeMs: z.number().nonnegative(),
  limits: LimitUsage.nullable(),
});
export type DashboardMetrics = z.infer<typeof DashboardMetrics>;
