import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { agents } from './agents';
import { conversations } from './conversations';

export const usageRecords = sqliteTable('usage_records', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  agentId: text('agent_id').references(() => agents.id),
  conversationId: text('conversation_id').references(() => conversations.id),
  event: text('event').notNull(),
  provider: text('provider'),
  quantity: real('quantity').notNull().default(0),
  cost: real('cost').notNull().default(0),
  metadata: text('metadata', { mode: 'json' }).notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  idx_usage_records_tenant_id: index('idx_usage_records_tenant_id').on(t.tenantId),
  idx_usage_records_agent_id: index('idx_usage_records_agent_id').on(t.agentId),
  idx_usage_records_created_at: index('idx_usage_records_created_at').on(t.createdAt),
}));
