import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] }).notNull().default('member'),
  status: text('status', { enum: ['active', 'inactive', 'suspended'] }).notNull().default('active'),
  avatarUrl: text('avatar_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (t) => ({
  idx_users_tenant_id: index('idx_users_tenant_id').on(t.tenantId),
  idx_users_deleted_at: index('idx_users_deleted_at').on(t.deletedAt),
}));
