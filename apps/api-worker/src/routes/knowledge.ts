import { Hono } from 'hono';
import { Context } from 'hono';
import { KnowledgeBaseRepository, DocumentRepository, AuditLogRepository } from '@ai-agent/database';
import { AuditLogger } from '@ai-agent/shared';
import { requirePermission } from '../middleware';
import { z } from 'zod';

const createKBSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).trim(),
  description: z.string().max(2000).optional(),
  config: z.record(z.unknown()).optional(),
});

const knowledge = new Hono();

knowledge.get('/', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const repo = new KnowledgeBaseRepository(db);
  const kbs = await repo.findByTenantId(tenantId);
  return c.json({ success: true, data: kbs });
});

knowledge.post('/', async (c: Context) => {
  const denied = requirePermission(c, 'create:knowledge');
  if (denied) return denied;
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  
  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = createKBSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid request', requestId: c.get('requestId') } }, 400);
  }
  const body = parsed.data;

  const repo = new KnowledgeBaseRepository(db);
  const kb = await repo.create({
    tenantId,
    name: body.name,
    description: body.description,
    config: body.config,
  });

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.logCreate(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    'knowledge_base', kb.id,
    { name: kb.name, description: kb.description }
  );

  return c.json({ success: true, data: kb }, 201);
});

knowledge.get('/:id', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const repo = new KnowledgeBaseRepository(db);
  const kb = await repo.findById(id, tenantId);
  if (!kb || kb.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'KNOWLEDGE_BASE_NOT_FOUND', message: 'Knowledge base not found', requestId: c.get('requestId') } }, 404);
  }
  return c.json({ success: true, data: kb });
});

knowledge.delete('/:id', async (c: Context) => {
  const denied = requirePermission(c, 'delete:knowledge');
  if (denied) return denied;
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const repo = new KnowledgeBaseRepository(db);
  const kb = await repo.findById(id, tenantId);
  if (!kb || kb.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'KNOWLEDGE_BASE_NOT_FOUND', message: 'Knowledge base not found', requestId: c.get('requestId') } }, 404);
  }
  await repo.softDelete(id, tenantId);

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.logDelete(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    'knowledge_base', id
  );

  return c.json({ success: true, data: null });
});

knowledge.post('/:id/documents', async (c: Context) => {
  const denied = requirePermission(c, 'create:knowledge');
  if (denied) return denied;
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const kbRepo = new KnowledgeBaseRepository(db);
  const docRepo = new DocumentRepository(db);

  const kb = await kbRepo.findById(id, tenantId);
  if (!kb || kb.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'KNOWLEDGE_BASE_NOT_FOUND', message: 'Knowledge base not found', requestId: c.get('requestId') } }, 404);
  }

  const body = await c.req.parseBody();
  const file = body['file'] as File;
  if (!file) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'No file provided', requestId: c.get('requestId') } }, 400);
  }

  // Validate file size (10MB max)
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'File too large (max 10MB)', requestId: c.get('requestId') } }, 400);
  }

  // Validate file type
  const ALLOWED_TYPES = ['text/plain', 'text/markdown', 'text/html', 'application/pdf', 'text/csv', 'application/json'];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: `Unsupported file type: ${file.type}`, requestId: c.get('requestId') } }, 400);
  }

  // Sanitize filename — remove path separators and null bytes
  const sanitizedFilename = file.name.replace(/[\/\\:*?"<>|\x00]/g, '_').substring(0, 255);

  // Store file in R2
  const r2Key = `knowledge/${kb.id}/${Date.now()}-${sanitizedFilename}`;
  const arrayBuffer = await file.arrayBuffer();
  await c.env.R2.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  // Create document record
  const doc = await docRepo.create({
    knowledgeBaseId: kb.id,
    tenantId,
    source: { type: 'upload', r2Key, originalName: sanitizedFilename },
    filename: sanitizedFilename,
    mimeType: file.type,
    sizeBytes: file.size,
  });

  // Queue for ingestion
  await c.env.INGESTION_QUEUE.send({
    documentId: doc.id,
    knowledgeBaseId: kb.id,
    tenantId,
    r2Key,
  });

  await kbRepo.incrementDocumentCount(kb.id, tenantId);

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.logCreate(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    'document', doc.id,
    { filename: doc.filename, knowledgeBaseId: kb.id }
  );

  return c.json({ success: true, data: { id: doc.id, status: 'queued' } }, 202);
});

knowledge.get('/:id/documents', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const kbRepo = new KnowledgeBaseRepository(db);
  const docRepo = new DocumentRepository(db);

  const kb = await kbRepo.findById(id, tenantId);
  if (!kb || kb.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'KNOWLEDGE_BASE_NOT_FOUND', message: 'Knowledge base not found', requestId: c.get('requestId') } }, 404);
  }

  const docs = await docRepo.findByKnowledgeBaseId(kb.id, tenantId);
  return c.json({ success: true, data: docs });
});

knowledge.delete('/:id/documents/:documentId', async (c: Context) => {
  const denied = requirePermission(c, 'delete:knowledge');
  if (denied) return denied;
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const documentId = c.req.param('documentId')!;
  
  const kbRepo = new KnowledgeBaseRepository(db);
  const docRepo = new DocumentRepository(db);

  const kb = await kbRepo.findById(id, tenantId);
  if (!kb || kb.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'KNOWLEDGE_BASE_NOT_FOUND', message: 'Knowledge base not found', requestId: c.get('requestId') } }, 404);
  }

  const doc = await docRepo.findById(documentId, tenantId);
  if (!doc || doc.tenantId !== tenantId || doc.knowledgeBaseId !== id) {
    return c.json({ success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found', requestId: c.get('requestId') } }, 404);
  }

  // Set status to deleting to prevent further processing
  await docRepo.updateStatus(documentId, tenantId, 'failed', 'Marked for deletion');

  const source = doc.source as { type: string; r2Key?: string };
  const r2Key = source.r2Key || '';

  // Send delete action to Ingestion Worker
  await c.env.INGESTION_QUEUE.send({
    action: 'delete',
    documentId: doc.id,
    knowledgeBaseId: kb.id,
    tenantId,
    r2Key,
  });

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.logDelete(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    'document', documentId
  );

  return c.json({ success: true, data: null }, 202);
});

export default knowledge;
