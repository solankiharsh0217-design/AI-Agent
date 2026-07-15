import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { agents } from './agents';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  agentId: text('agent_id').notNull().references(() => agents.id),
  conversationId: text('conversation_id').notNull(),
  channel: text('channel', { enum: ['chat', 'voice', 'phone', 'api', 'whatsapp', 'slack', 'teams'] }).notNull(),
  status: text('status', { enum: ['created', 'active', 'listening', 'thinking', 'responding', 'waiting', 'ended', 'expired', 'error'] }).notNull().default('created'),
  metadata: text('metadata', { mode: 'json' }).notNull().default('{}'),
  state: text('state', { mode: 'json' }).notNull().default('{}'),
  voiceState: text('voice_state', { mode: 'json' }),
  phoneState: text('phone_state', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
}, (t) => ({
  idx_sessions_tenant_id: index('idx_sessions_tenant_id').on(t.tenantId),
  idx_sessions_agent_id: index('idx_sessions_agent_id').on(t.agentId),
  idx_sessions_conversation_id: index('idx_sessions_conversation_id').on(t.conversationId),
}));
