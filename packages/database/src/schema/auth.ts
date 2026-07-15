import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  permissions: text('permissions', { mode: 'json' }).notNull().default('[]'),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
}, (t) => ({
  idx_api_keys_tenant_id: index('idx_api_keys_tenant_id').on(t.tenantId),
  idx_api_keys_key_hash: index('idx_api_keys_key_hash').on(t.keyHash),
}));

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  userId: text('user_id'),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id'),
  oldValues: text('old_values', { mode: 'json' }),
  newValues: text('new_values', { mode: 'json' }),
  ipAddress: text('ip_address'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  idx_audit_logs_tenant_id: index('idx_audit_logs_tenant_id').on(t.tenantId),
  idx_audit_logs_resource: index('idx_audit_logs_resource').on(t.resource, t.resourceId),
  idx_audit_logs_created_at: index('idx_audit_logs_created_at').on(t.createdAt),
}));
