import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { conversations } from './conversations';
import { tenants } from './tenants';

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  sessionId: text('session_id'),
  role: text('role', { enum: ['system', 'user', 'assistant', 'tool'] }).notNull(),
  content: text('content').notNull(),
  type: text('type', { enum: ['text', 'image', 'audio', 'file', 'tool_result', 'system'] }).notNull().default('text'),
  metadata: text('metadata', { mode: 'json' }).notNull().default('{}'),
  toolCalls: text('tool_calls', { mode: 'json' }).notNull().default('[]'),
  toolCallId: text('tool_call_id'),
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  totalTokens: integer('total_tokens').default(0),
  estimatedCostUsd: real('estimated_cost_usd').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  idx_messages_conversation_id: index('idx_messages_conversation_id').on(t.conversationId),
  idx_messages_tenant_id: index('idx_messages_tenant_id').on(t.tenantId),
  idx_messages_created_at: index('idx_messages_created_at').on(t.createdAt),
}));
