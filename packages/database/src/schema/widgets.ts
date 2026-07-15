import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { agents } from './agents';

export const widgets = sqliteTable('widgets', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  agentId: text('agent_id').notNull().references(() => agents.id),
  name: text('name').notNull(),
  config: text('config', { mode: 'json' }).notNull().default('{}'),
  status: text('status', { enum: ['active', 'inactive', 'deleted'] }).notNull().default('active'),
  domains: text('domains', { mode: 'json' }).notNull().default('[]'),
  signedSecret: text('signed_secret'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (t) => ({
  idx_widgets_tenant_id: index('idx_widgets_tenant_id').on(t.tenantId),
  idx_widgets_agent_id: index('idx_widgets_agent_id').on(t.agentId),
}));
