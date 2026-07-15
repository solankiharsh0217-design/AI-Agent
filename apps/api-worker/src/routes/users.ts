import { Hono } from 'hono';
import { Context } from 'hono';
import { UserRepository } from '@ai-agent/database';

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

export default users;
