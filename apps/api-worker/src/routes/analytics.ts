import { Hono } from 'hono';
import { Context } from 'hono';
import { UsageRepository } from '@ai-agent/database';

const analytics = new Hono();

function safeParseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

analytics.get('/', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const usageRepo = new UsageRepository(db);

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

analytics.get('/usage', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const repo = new UsageRepository(db);

  const from = safeParseDate(c.req.query('from'));
  const to = safeParseDate(c.req.query('to'));

  const usage = await repo.getUsageByTenant(tenantId, { from, to });
  return c.json({ success: true, data: usage });
});

analytics.get('/cost', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const repo = new UsageRepository(db);

  const from = safeParseDate(c.req.query('from'));
  const to = safeParseDate(c.req.query('to'));

  const cost = await repo.getTotalCost(tenantId, { from, to });
  return c.json({ success: true, data: { totalCost: cost } });
});

export default analytics;
