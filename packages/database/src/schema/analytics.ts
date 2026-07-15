import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { agents } from './agents';
import { conversations } from './conversations';

export const analyticsEvents = sqliteTable('analytics_events', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  agentId: text('agent_id').references(() => agents.id),
  conversationId: text('conversation_id').references(() => conversations.id),
  event: text('event').notNull(),
  channel: text('channel'),
  metadata: text('metadata', { mode: 'json' }).notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  idx_analytics_events_tenant_id: index('idx_analytics_events_tenant_id').on(t.tenantId),
  idx_analytics_events_agent_id: index('idx_analytics_events_agent_id').on(t.agentId),
  idx_analytics_events_created_at: index('idx_analytics_events_created_at').on(t.createdAt),
}));
