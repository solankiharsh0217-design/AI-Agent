import { Hono } from 'hono';
import { Context } from 'hono';
import { PhoneNumberRepository, CallRepository, AgentRepository, AuditLogRepository } from '@ai-agent/database';
import { AuditLogger } from '@ai-agent/shared';
import { z } from 'zod';

const createNumberSchema = z.object({
  phoneNumber: z.string().min(1, 'phoneNumber is required'),
  friendlyName: z.string().optional(),
  provider: z.string().optional(),
  monthlyCost: z.number().optional(),
  providerReference: z.string().optional(),
});

const assignNumberSchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
});

const phone = new Hono();

phone.get('/numbers', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const repo = new PhoneNumberRepository(db);
  const numbers = await repo.findByTenantId(tenantId);
  return c.json({ success: true, data: numbers });
});

phone.post('/numbers', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  
  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = createNumberSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid request', requestId: c.get('requestId') } }, 400);
  }
  const body = parsed.data;

  const repo = new PhoneNumberRepository(db);
  const number = await repo.create({
    tenantId,
    phoneNumber: body.phoneNumber,
    friendlyName: body.friendlyName,
    provider: body.provider,
    monthlyCost: body.monthlyCost,
    providerReference: body.providerReference,
  });

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.logCreate(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    'phone_number', number.id,
    { phoneNumber: number.phoneNumber, friendlyName: number.friendlyName }
  );

  return c.json({ success: true, data: number }, 201);
});

phone.post('/numbers/:id/assign', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  const id = c.req.param('id')!;
  
  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = assignNumberSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid request', requestId: c.get('requestId') } }, 400);
  }
  const body = parsed.data;

  const repo = new PhoneNumberRepository(db);
  const agentRepo = new AgentRepository(db);
  const number = await repo.findById(id, tenantId);
  if (!number || number.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'PHONE_NUMBER_NOT_FOUND', message: 'Phone number not found', requestId: c.get('requestId') } }, 404);
  }
  // Verify agent belongs to same tenant
  const agent = await agentRepo.findById(body.agentId, tenantId);
  if (!agent || agent.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found', requestId: c.get('requestId') } }, 404);
  }
  const assigned = await repo.assignAgent(id, tenantId, body.agentId);

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.log(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    { action: 'assign', resource: 'phone_number', resourceId: id }
  );

  return c.json({ success: true, data: assigned });
});

phone.post('/numbers/:id/release', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db');
  const id = c.req.param('id')!;
  const repo = new PhoneNumberRepository(db);
  const number = await repo.findById(id, tenantId);
  if (!number || number.tenantId !== tenantId) {
    return c.json({ success: false, error: { code: 'PHONE_NUMBER_NOT_FOUND', message: 'Phone number not found', requestId: c.get('requestId') } }, 404);
  }
  const released = await repo.release(id, tenantId);

  const audit = new AuditLogger(new AuditLogRepository(db));
  await audit.log(
    { tenantId, userId, ipAddress: c.req.header('CF-Connecting-IP') ?? undefined },
    { action: 'release', resource: 'phone_number', resourceId: id }
  );

  return c.json({ success: true, data: released });
});

phone.get('/calls', async (c: Context) => {
  const tenantId = c.get('tenantId') as string;
  const db = c.get('db');
  const repo = new CallRepository(db);
  const calls = await repo.findByTenantId(tenantId);
  return c.json({ success: true, data: calls });
});

// Public webhook endpoint — no auth (Twilio calls this directly)
phone.post('/webhook/voice', async (c: Context) => {
  const twilioSignature = c.req.header('X-Twilio-Signature');
  if (!twilioSignature) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing Twilio signature' } }, 401);
  }

  const authToken = (c.env as any).TWILIO_AUTH_TOKEN as string | undefined;
  if (!authToken) {
    return c.json({ success: false, error: { code: 'CONFIGURATION_ERROR', message: 'Twilio auth token not configured' } }, 500);
  }

  const url = c.req.url;
  const formData = await c.req.parseBody();
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === 'string') {
      params[key] = value;
    }
  }

  // Dynamic import to avoid pulling Twilio provider into the auth'd route bundle
  const { TwilioProvider } = await import('@ai-agent/providers');
  const twilio = new TwilioProvider({ accountSid: '', authToken, webhookBaseUrl: '', timeout: 10000 });
  const valid = await twilio.validateWebhook(twilioSignature, url, params);

  if (!valid) {
    return c.json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature validation failed' } }, 401);
  }

  const db = c.get('db');
  const phoneRepo = new PhoneNumberRepository(db as any);
  const numberRecord = await phoneRepo.findByPhoneNumber(params.To || '');

  c.header('Content-Type', 'text/xml');

  if (!numberRecord) {
    return c.body(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this number is not configured on our system.</Say></Response>',
      200,
      { 'Content-Type': 'text/xml' }
    );
  }

  if (!numberRecord.agentId) {
    return c.body(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Hello, this phone number has no active agent assigned.</Say></Response>',
      200,
      { 'Content-Type': 'text/xml' }
    );
  }

  const { SessionRepository, ConversationRepository } = await import('@ai-agent/database');
  const sessionRepo = new SessionRepository(db as any);
  const convRepo = new ConversationRepository(db as any);
  const callRepo = new CallRepository(db as any);

  const callSid = params.CallSid || crypto.randomUUID();

  const conversation = await convRepo.create({
    tenantId: numberRecord.tenantId,
    agentId: numberRecord.agentId,
    channel: 'voice',
  });

  await sessionRepo.create({
    id: callSid,
    tenantId: numberRecord.tenantId,
    agentId: numberRecord.agentId,
    conversationId: conversation.id,
    channel: 'voice',
  });

  await callRepo.create({
    id: callSid,
    tenantId: numberRecord.tenantId,
    phoneNumberId: numberRecord.id,
    agentId: numberRecord.agentId,
    direction: 'inbound',
    from: params.From || 'unknown',
    to: params.To || 'unknown',
  });

  const host = c.req.header('Host') || 'api.yourdomain.com';
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'ws' : 'wss';

  // Issue a signed token bound to this CallSid so the media WebSocket can be
  // authenticated (Twilio doesn't sign the media stream upgrade).
  const internalSecret = (c.env as any).INTERNAL_API_SECRET as string;
  const { signCallToken } = await import('../twilio-stream-token');
  const streamToken = await signCallToken(internalSecret, callSid);

  const query = new URLSearchParams({
    CallSid: callSid,
    tenantId: numberRecord.tenantId,
    token: streamToken,
  });
  const streamUrl = `${protocol}://${host}/twilio/media?${query.toString()}`;

  return c.body(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${streamUrl}" /></Connect></Response>`,
    200,
    { 'Content-Type': 'text/xml' }
  );
});

export default phone;
