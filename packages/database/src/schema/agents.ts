import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description'),
  config: text('config', { mode: 'json' }).notNull().default('{}'),
  status: text('status', { enum: ['draft', 'published', 'archived', 'deleted'] }).notNull().default('draft'),
  version: integer('version').notNull().default(1),
  publishedVersion: integer('published_version'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (t) => ({
  idx_agents_tenant_id: index('idx_agents_tenant_id').on(t.tenantId),
  idx_agents_status: index('idx_agents_status').on(t.status),
}));
