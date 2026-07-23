import { Hono } from 'hono';
import { requirePermission } from '../middleware';
import { UsageRepository } from '@ai-agent/database';
import type { Env, AppVariables } from '../context';

const analytics = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function safeParseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

analytics.get('/', async (c) => {
  const denied = requirePermission(c, 'view:analytics');
  if (denied) return denied;
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const usageRepo = new UsageRepository(db as any);

  const from = safeParseDate(c.req.query('from'));
  const to = safeParseDate(c.req.query('to'));

  const usage = await usageRepo.getUsageByTenant(tenantId, { from, to });
  const totalCost = await usageRepo.getTotalCost(tenantId, { from, to });

  return c.json({
    success: true,
    data: {
      usage,
      totalCost,
      period: { from: from?.toISOString(), to: to?.toISOString() },
    },
  });
});

analytics.get('/usage', async (c) => {
  const denied = requirePermission(c, 'view:analytics');
  if (denied) return denied;
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const repo = new UsageRepository(db as any);

  const from = safeParseDate(c.req.query('from'));
  const to = safeParseDate(c.req.query('to'));

  const usage = await repo.getUsageByTenant(tenantId, { from, to });
  return c.json({ success: true, data: usage });
});

analytics.get('/cost', async (c) => {
  const denied = requirePermission(c, 'view:analytics');
  if (denied) return denied;
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const repo = new UsageRepository(db as any);

  const from = safeParseDate(c.req.query('from'));
  const to = safeParseDate(c.req.query('to'));

  const cost = await repo.getTotalCost(tenantId, { from, to });
  return c.json({ success: true, data: { totalCost: cost } });
});

export default analytics;
