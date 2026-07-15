import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { agents } from './agents';

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  agentId: text('agent_id').notNull().references(() => agents.id),
  sessionId: text('session_id'),
  channel: text('channel', { enum: ['chat', 'voice', 'phone', 'api', 'whatsapp', 'slack', 'teams'] }).notNull(),
  status: text('status', { enum: ['active', 'ended', 'archived', 'transferred'] }).notNull().default('active'),
  summary: text('summary'),
  messageCount: integer('message_count').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  totalCostUsd: real('total_cost_usd').notNull().default(0),
  metadata: text('metadata', { mode: 'json' }).notNull().default('{}'),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  idx_conversations_tenant_id: index('idx_conversations_tenant_id').on(t.tenantId),
  idx_conversations_agent_id: index('idx_conversations_agent_id').on(t.agentId),
  idx_conversations_status: index('idx_conversations_status').on(t.status),
  idx_conversations_created_at: index('idx_conversations_created_at').on(t.createdAt),
}));
