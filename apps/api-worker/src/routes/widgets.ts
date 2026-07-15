import { Hono } from 'hono';
import { Context } from 'hono';
import { WidgetRepository, AgentRepository, AuditLogRepository } from '@ai-agent/database';
import { AuditLogger } from '@ai-agent/shared';
import { z } from 'zod';

const createWidgetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).trim(),
  agentId: z.string().min(1, 'agentId is required'),
  config: z.record(z.unknown()).default({}),
  domains: z.array(z.string()).default([]),
});

const updateWidgetSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  config: z.record(z.unknown()).optional(),
  status: z.enum(['active', 'inactive', 'deleted']).optional(),
  domains: z.array(z.string()).optional(),
});

const widgets = new Hono();

widgets.get('/', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const repo = new WidgetRepository(db);
  const widgets = await repo.findByTenantId(tenantId);
  return c.json({ success: true, data: widgets });
});

widgets.post('/', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  
  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = createWidgetSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid request', requestId: c.get('requestId') } }, 400);
  }
  const body = parsed.data;

  const agentRepo = new AgentRepository(db);
  const agent = await agentRepo.findById(body.agentId, tenantId);
  if (!agent || agent.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found', requestId: c.get('requestId') } }, 404);
  }

  const repo = new WidgetRepository(db);
  const widget = await repo.create({
    tenantId,
    agentId: body.agentId,
    name: body.name,
    config: body.config,
    domains: body.domains,
  });

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.logCreate(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    'widget', widget.id,
    { name: widget.name, agentId: widget.agentId }
  );

  return c.json({ success: true, data: widget }, 201);
});

widgets.get('/:id', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const repo = new WidgetRepository(db);
  const widget = await repo.findById(id, tenantId);
  if (!widget || widget.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'WIDGET_NOT_FOUND', message: 'Widget not found', requestId: c.get('requestId') } }, 404);
  }
  return c.json({ success: true, data: widget });
});

widgets.patch('/:id', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  const id = c.req.param('id')!;
  
  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = updateWidgetSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid request', requestId: c.get('requestId') } }, 400);
  }
  const body = parsed.data;

  const repo = new WidgetRepository(db);
  const widget = await repo.findById(id, tenantId);
  if (!widget || widget.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'WIDGET_NOT_FOUND', message: 'Widget not found', requestId: c.get('requestId') } }, 404);
  }
  const { name, config, status, domains } = body;
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (config !== undefined) updateData.config = config;
  if (status !== undefined) updateData.status = status;
  if (domains !== undefined) updateData.domains = domains;
  const updated = await repo.update(id, tenantId, updateData as any);

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.logUpdate(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    'widget', id,
    { name: widget.name, config: widget.config },
    { name: updated.name, config: updated.config }
  );

  return c.json({ success: true, data: updated });
});

widgets.delete('/:id', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const repo = new WidgetRepository(db);
  const widget = await repo.findById(id, tenantId);
  if (!widget || widget.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'WIDGET_NOT_FOUND', message: 'Widget not found', requestId: c.get('requestId') } }, 404);
  }
  await repo.softDelete(id, tenantId);

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.logDelete(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    'widget', id
  );

  return c.json({ success: true, data: null });
});

export default widgets;
