import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { knowledgeBases } from './knowledge-bases';
import { documents } from './documents';

export const chunks = sqliteTable('chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id),
  knowledgeBaseId: text('knowledge_base_id').notNull().references(() => knowledgeBases.id),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  index: integer('index').notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count').notNull(),
  metadata: text('metadata', { mode: 'json' }).notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  idx_chunks_document_id: index('idx_chunks_document_id').on(t.documentId),
  idx_chunks_knowledge_base_id: index('idx_chunks_knowledge_base_id').on(t.knowledgeBaseId),
  idx_chunks_tenant_id: index('idx_chunks_tenant_id').on(t.tenantId),
}));
