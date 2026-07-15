import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { agents } from './agents';

export const phoneNumbers = sqliteTable('phone_numbers', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  agentId: text('agent_id').references(() => agents.id),
  provider: text('provider').notNull().default('twilio'),
  phoneNumber: text('phone_number').notNull(),
  friendlyName: text('friendly_name'),
  capabilities: text('capabilities', { mode: 'json' }).notNull().default('{}'),
  status: text('status', { enum: ['available', 'assigned', 'released'] }).notNull().default('available'),
  providerReference: text('provider_reference'),
  monthlyCost: real('monthly_cost').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  idx_phone_numbers_tenant_id: index('idx_phone_numbers_tenant_id').on(t.tenantId),
  idx_phone_numbers_agent_id: index('idx_phone_numbers_agent_id').on(t.agentId),
  idx_phone_numbers_phone_number: index('idx_phone_numbers_phone_number').on(t.phoneNumber),
}));
