import { Hono } from 'hono';
import { Context } from 'hono';
import { UserRepository } from '@ai-agent/database';
import { z } from 'zod';

const updateMeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).trim().optional(),
  avatarUrl: z.string().url().optional(),
});

const users = new Hono();

users.get('/me', async (c: Context) => {
  const userId = c.get('userId') as string;
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const repo = new UserRepository(db);
  const user = await repo.findById(userId, tenantId);
  if (!user) {
    return c.json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found', requestId: c.get('requestId') } }, 404);
  }
  return c.json({ success: true, data: user });
});

users.patch('/me', async (c: Context) => {
  const userId = c.get('userId') as string;
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');

  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = updateMeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid request', requestId: c.get('requestId') } }, 400);
  }
  const body = parsed.data;

  const repo = new UserRepository(db);
  const user = await repo.findById(userId, tenantId);
  if (!user) {
    return c.json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found', requestId: c.get('requestId') } }, 404);
  }

  await repo.update(userId, tenantId, body);
  const updated = await repo.findById(userId, tenantId);
  return c.json({ success: true, data: updated });
});

export default users;
