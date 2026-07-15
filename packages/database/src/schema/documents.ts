import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { knowledgeBases } from './knowledge-bases';

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  knowledgeBaseId: text('knowledge_base_id').notNull().references(() => knowledgeBases.id),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  source: text('source', { mode: 'json' }).notNull(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  status: text('status', { enum: ['queued', 'downloading', 'parsing', 'chunking', 'embedding', 'indexing', 'completed', 'failed'] }).notNull().default('queued'),
  processingError: text('processing_error'),
  chunkCount: integer('chunk_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (t) => ({
  idx_documents_knowledge_base_id: index('idx_documents_knowledge_base_id').on(t.knowledgeBaseId),
  idx_documents_tenant_id: index('idx_documents_tenant_id').on(t.tenantId),
  idx_documents_status: index('idx_documents_status').on(t.status),
  idx_documents_deleted_at: index('idx_documents_deleted_at').on(t.deletedAt),
}));
