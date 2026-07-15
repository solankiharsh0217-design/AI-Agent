import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { agents } from './agents';
import { phoneNumbers } from './phone-numbers';

export const calls = sqliteTable('calls', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  phoneNumberId: text('phone_number_id').notNull().references(() => phoneNumbers.id),
  agentId: text('agent_id').references(() => agents.id),
  direction: text('direction', { enum: ['inbound', 'outbound'] }).notNull(),
  from: text('from').notNull(),
  to: text('to').notNull(),
  status: text('status', { enum: ['initiated', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled'] }).notNull().default('initiated'),
  duration: integer('duration').notNull().default(0),
  recordingUrl: text('recording_url'),
  cost: integer('cost').notNull().default(0),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  idx_calls_tenant_id: index('idx_calls_tenant_id').on(t.tenantId),
  idx_calls_phone_number_id: index('idx_calls_phone_number_id').on(t.phoneNumberId),
  idx_calls_status: index('idx_calls_status').on(t.status),
  idx_calls_created_at: index('idx_calls_created_at').on(t.createdAt),
}));
