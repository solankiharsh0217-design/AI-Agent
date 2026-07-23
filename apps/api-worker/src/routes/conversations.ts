import { Hono } from 'hono';
import { Context } from 'hono';
import { ConversationRepository, AuditLogRepository } from '@ai-agent/database';
import { AuditLogger } from '@ai-agent/shared';
import { requirePermission } from '../middleware';

const conversations = new Hono();

conversations.get('/', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const repo = new ConversationRepository(db);
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20') || 20));
  const result = await repo.findByTenantId(tenantId, { page, limit });
  return c.json({ success: true, data: result.data, meta: result.meta });
});

conversations.get('/:id', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const repo = new ConversationRepository(db);
  const conv = await repo.findById(id, tenantId);
  if (!conv || conv.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found', requestId: c.get('requestId') } }, 404);
  }
  return c.json({ success: true, data: conv });
});

conversations.delete('/:id', async (c: Context) => {
  const denied = requirePermission(c, 'manage:conversations');
  if (denied) return denied;
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const repo = new ConversationRepository(db);
  const conv = await repo.findById(id, tenantId);
  if (!conv || conv.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found', requestId: c.get('requestId') } }, 404);
  }
  await repo.end(id, tenantId);

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.logDelete(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    'conversation', id
  );

  return c.json({ success: true, data: null });
});

conversations.get('/:id/messages', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const repo = new ConversationRepository(db);
  const conv = await repo.findById(id, tenantId);
  if (!conv || conv.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found', requestId: c.get('requestId') } }, 404);
  }
  const messages = await repo.getMessages(id, tenantId);
  return c.json({ success: true, data: messages });
});

export default conversations;
