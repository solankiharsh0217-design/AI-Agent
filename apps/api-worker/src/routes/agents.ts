import { Hono } from 'hono';
import { Context } from 'hono';
import { AgentRepository, AuditLogRepository } from '@ai-agent/database';
import { AuditLogger } from '@ai-agent/shared';
import { z } from 'zod';

const createAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).trim(),
  description: z.string().max(2000).optional(),
  config: z.record(z.unknown()).default({}),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(2000).optional(),
  config: z.record(z.unknown()).optional(),
  status: z.enum(['draft', 'published', 'archived', 'deleted']).optional(),
});

const agents = new Hono();

agents.get('/', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const repo = new AgentRepository(db);
  const agents = await repo.findByTenantId(tenantId);
  return c.json({ success: true, data: agents });
});

agents.post('/', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  
  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = createAgentSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid request', requestId: c.get('requestId') } }, 400);
  }
  const body = parsed.data;

  const repo = new AgentRepository(db);
  const agent = await repo.create({
    tenantId,
    name: body.name,
    description: body.description,
    config: body.config,
  });

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.logCreate(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    'agent', agent.id,
    { name: agent.name, description: agent.description }
  );

  return c.json({ success: true, data: agent }, 201);
});

agents.get('/:id', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const repo = new AgentRepository(db);
  const agent = await repo.findById(id, tenantId);
  if (!agent || agent.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found', requestId: c.get('requestId') } }, 404);
  }
  return c.json({ success: true, data: agent });
});

agents.patch('/:id', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  const id = c.req.param('id')!;
  
  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = updateAgentSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid request', requestId: c.get('requestId') } }, 400);
  }
  const body = parsed.data;

  const repo = new AgentRepository(db);
  const agent = await repo.findById(id, tenantId);
  if (!agent || agent.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found', requestId: c.get('requestId') } }, 404);
  }
  const { name, description, config, status } = body;
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (config !== undefined) updateData.config = config;
  if (status !== undefined) updateData.status = status;
  const updated = await repo.update(id, tenantId, updateData as any);

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.logUpdate(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    'agent', id,
    { name: agent.name, description: agent.description },
    { name: updated.name, description: updated.description }
  );

  return c.json({ success: true, data: updated });
});

agents.delete('/:id', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const repo = new AgentRepository(db);
  const agent = await repo.findById(id, tenantId);
  if (!agent || agent.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found', requestId: c.get('requestId') } }, 404);
  }
  await repo.softDelete(id, tenantId);

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.logDelete(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    'agent', id
  );

  return c.json({ success: true, data: null });
});

agents.post('/:id/publish', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const repo = new AgentRepository(db);
  const agent = await repo.findById(id, tenantId);
  if (!agent || agent.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found', requestId: c.get('requestId') } }, 404);
  }
  const published = await repo.publish(id, tenantId);

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.log(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    { action: 'publish', resource: 'agent', resourceId: id }
  );

  return c.json({ success: true, data: published });
});

agents.post('/:id/archive', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const repo = new AgentRepository(db);
  const agent = await repo.findById(id, tenantId);
  if (!agent || agent.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found', requestId: c.get('requestId') } }, 404);
  }
  const archived = await repo.archive(id, tenantId);

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.log(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    { action: 'archive', resource: 'agent', resourceId: id }
  );

  return c.json({ success: true, data: archived });
});

export default agents;
