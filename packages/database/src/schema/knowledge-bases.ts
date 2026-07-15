import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';

export const knowledgeBases = sqliteTable('knowledge_bases', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description'),
  config: text('config', { mode: 'json' }).notNull().default('{}'),
  documentCount: integer('document_count').notNull().default(0),
  chunkCount: integer('chunk_count').notNull().default(0),
  totalSizeBytes: integer('total_size_bytes').notNull().default(0),
  status: text('status', { enum: ['active', 'archived', 'processing', 'error'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (t) => ({
  idx_knowledge_bases_tenant_id: index('idx_knowledge_bases_tenant_id').on(t.tenantId),
}));
