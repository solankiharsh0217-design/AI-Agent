import { Hono } from 'hono';
import { Env, AppVariables, logger, createAppContext } from './context';
import { requestIdMiddleware, corsMiddleware, securityHeadersMiddleware, loggingMiddleware, authMiddleware } from './middleware';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { tenants } from '@ai-agent/database';
import { eq } from 'drizzle-orm';
import agents from './routes/agents';
import knowledge from './routes/knowledge';
import conversations from './routes/conversations';
import widgets from './routes/widgets';
import analytics from './routes/analytics';
import users from './routes/users';
import phone from './routes/phone';
import billing from './routes/billing';

import { bodyLimit } from 'hono/body-limit';

let cachedEnv: any = null;
let cachedContext: any = null;
let cachedEnvId: string | null = null;

function getOrCreateContext(env: any) {
  // Create a stable identifier from the env's D1 binding since env is a new Proxy per request
  const envId = env.DB?.id ?? 'default';
  if (cachedEnvId === envId && cachedContext) return cachedContext;
  cachedEnvId = envId;
  cachedEnv = env;
  cachedContext = createAppContext(env);
  return cachedContext;
}

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// Export Durable Object class so that Cloudflare runtime can find it
export { SessionDurableObject } from './durable/session';

// Global middleware
app.use('*', bodyLimit({
  maxSize: 10 * 1024 * 1024, // 10MB limit
  onError: (c) => {
    return c.json({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large (max 10MB)' } }, 413 as any);
  },
}));
app.use('*', corsMiddleware);
app.use('*', securityHeadersMiddleware);
app.use('*', requestIdMiddleware);
app.use('*', loggingMiddleware);

// Health check
app.get('/', (c) => {
  return c.json({
    success: true,
    data: {
      service: 'ai-agent-platform-api',
      version: '0.1.0',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

app.get('/health', (c) => {
  return c.json({ success: true, data: { status: 'healthy' } });
});

// API v1 routes
const v1 = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// Auth middleware — verifies Clerk JWT and extracts tenant/user
v1.use('*', async (c, next) => {
  const { db, registry } = getOrCreateContext(c.env);
  c.set('db', db);
  c.set('registry', registry);

  // Bypass Clerk authentication for the public Twilio and Razorpay webhooks
  if (c.req.path === '/api/v1/phone/webhook/voice' || c.req.path === '/api/v1/billing/webhook') {
    await next();
    return;
  }

  const authResult = await authMiddleware(c.req.header('Authorization'), c.env);
  if (authResult.error) {
    return c.json({
      success: false,
      error: { code: authResult.error.code, message: authResult.error.message, requestId: c.get('requestId') },
    }, authResult.error.status as any);
  }

  c.set('tenantId', authResult.tenantId);
  c.set('userId', authResult.userId);
  c.set('userRole', authResult.role);

  await next();
});

// Auto-provision tenant on first request
v1.use('*', async (c, next) => {
  const tenantId = c.get('tenantId') as string;
  if (!tenantId) { await next(); return; }

  try {
    const db = c.get('db');
    const existing = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (existing.length === 0) {
      await db.insert(tenants).values({
        id: tenantId,
        name: tenantId,
        slug: tenantId.slice(0, 63),
      });
    }
  } catch (err: any) {
    logger.error('Tenant auto-provision failed', { tenantId, error: err?.message });
  }

  await next();
});

// Rate limiting — 100 requests per minute per tenant
v1.use('*', rateLimitMiddleware({ windowMs: 60_000, maxRequests: 100 }));

// Mount routes
v1.route('/agents', agents);
v1.route('/knowledge', knowledge);
v1.route('/conversations', conversations);
v1.route('/widgets', widgets);
v1.route('/analytics', analytics);
v1.route('/users', users);
v1.route('/phone', phone);
v1.route('/billing', billing);

app.route('/api/v1', v1);

// Public widget endpoints (no dashboard auth required)
const widgetsPublic = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function validateWidgetDomain(allowedDomains: unknown, origin: string | undefined, widgetToken?: string): boolean {
  // Allow if valid widget token is provided (for iframe contexts where Origin may be null)
  if (widgetToken) return true;
  
  if (!origin) return false;
  
  let domainsList: string[] = [];
  if (Array.isArray(allowedDomains)) {
    domainsList = allowedDomains;
  } else if (typeof allowedDomains === 'string') {
    try {
      domainsList = JSON.parse(allowedDomains);
    } catch {
      domainsList = [];
    }
  }

  // Deny by default when no domains are configured
  if (domainsList.length === 0) return false;
  if (domainsList.includes('*')) return true;

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  const originHost = parsedOrigin.hostname;

  return domainsList.some(d => {
    const allowed = d.trim().toLowerCase();
    if (allowed === originHost) return true;
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(2);
      return originHost.endsWith(suffix) && originHost.length > suffix.length;
    }
    return false;
  });
}

// Rate limit public widget endpoints — 30 req/min per IP
widgetsPublic.use('*', rateLimitMiddleware({ windowMs: 60_000, maxRequests: 30 }));

widgetsPublic.use('*', async (c, next) => {
  const { db, registry } = getOrCreateContext(c.env);
  c.set('db', db);
  c.set('registry', registry);
  await next();
});

// GET /api/widgets/:id (Get configuration)
widgetsPublic.get('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { WidgetRepository } = await import('@ai-agent/database');
  const repo = new WidgetRepository(db as any);
  const widget = await repo.findByIdUnscoped(id);
  if (!widget) {
    return c.json({ success: false, error: { code: 'WIDGET_NOT_FOUND', message: 'Widget not found' } }, 404);
  }

  const origin = c.req.header('Origin') || c.req.header('Referer');
  const widgetToken = c.req.query('token') || c.req.header('Authorization')?.slice(7);
  if (!validateWidgetDomain(widget.domains, origin, widgetToken)) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED_DOMAIN', message: 'Domain not whitelisted' } }, 403);
  }

  return c.json({ success: true, data: widget });
});

// POST /api/widgets/:id/sessions (Create widget session)
const MAX_WIDGET_SESSIONS = 100;

widgetsPublic.post('/:id/sessions', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { WidgetRepository, SessionRepository, ConversationRepository } = await import('@ai-agent/database');
  const widgetRepo = new WidgetRepository(db as any);
  const widget = await widgetRepo.findByIdUnscoped(id);
  if (!widget) {
    return c.json({ success: false, error: { code: 'WIDGET_NOT_FOUND', message: 'Widget not found' } }, 404);
  }

  const origin = c.req.header('Origin') || c.req.header('Referer');
  const widgetToken = c.req.query('token') || c.req.header('Authorization')?.slice(7);
  if (!validateWidgetDomain(widget.domains, origin, widgetToken)) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED_DOMAIN', message: 'Domain not whitelisted' } }, 403);
  }

  const sessionRepo = new SessionRepository(db as any);

  const activeSessions = await sessionRepo.findByAgentId(widget.agentId, widget.tenantId);
  const activeCount = activeSessions.filter((s: { status?: string }) => s.status !== 'ended' && s.status !== 'expired').length;
  if (activeCount >= MAX_WIDGET_SESSIONS) {
    return c.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many active sessions for this widget' } }, 429);
  }

  const convRepo = new ConversationRepository(db as any);

  const conversation = await convRepo.create({
    tenantId: widget.tenantId,
    agentId: widget.agentId,
    channel: 'chat',
  });

  const session = await sessionRepo.create({
    tenantId: widget.tenantId,
    agentId: widget.agentId,
    conversationId: conversation.id,
    channel: 'chat',
  });

  return c.json({
    success: true,
    data: {
      id: session.id,
      conversationId: conversation.id,
      tenantId: widget.tenantId,
    },
  });
});

// POST /api/widgets/:id/messages (Sync chat message fallback)
widgetsPublic.post('/:id/messages', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { WidgetRepository } = await import('@ai-agent/database');
  const repo = new WidgetRepository(db as any);
  const widget = await repo.findByIdUnscoped(id);
  if (!widget) {
    return c.json({ success: false, error: { code: 'WIDGET_NOT_FOUND', message: 'Widget not found' } }, 404);
  }

  const origin = c.req.header('Origin') || c.req.header('Referer');
  const widgetToken = c.req.query('token') || c.req.header('Authorization')?.slice(7);
  if (!validateWidgetDomain(widget.domains, origin, widgetToken)) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED_DOMAIN', message: 'Domain not whitelisted' } }, 403);
  }

  // Parse body once to avoid double-consumption of the request stream
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const sessionId = c.req.query('sessionId') || (body.sessionId as string | undefined);
  const content = c.req.query('content') || (body.content as string | undefined);

  if (!sessionId || !content) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'sessionId and content are required' } }, 400);
  }

  if (typeof content !== 'string' || content.length === 0 || content.length > 10000) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'content must be a non-empty string (max 10000 chars)' } }, 400);
  }

  let doId;
  try {
    doId = c.env.SESSION_DO.idFromString(sessionId);
  } catch {
    doId = c.env.SESSION_DO.idFromName(sessionId);
  }
  const stub = c.env.SESSION_DO.get(doId);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Internal-Auth': c.env.INTERNAL_API_SECRET,
    'X-Tenant-Id': widget.tenantId,
  };
  const doRes = await stub.fetch(new Request(`${c.req.url.split('/api/widgets')[0]}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content, widgetId: c.req.param('id') }),
  }));
  return c.body(doRes.body as any, doRes.status as any, Object.fromEntries(doRes.headers));
});

app.route('/api/widgets', widgetsPublic);

// WebSocket upgrade endpoints
app.all('/ws/widget', async (c) => {
  const sessionId = c.req.query('sessionId');
  const queryTenantId = c.req.query('tenantId');
  if (!sessionId) {
    return c.text('Missing sessionId', 400);
  }
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }

  // Authenticate widget token (optional — session-based auth via DO)
  const widgetToken = c.req.query('token') || c.req.header('Authorization')?.slice(7);

  try {
    const { db } = getOrCreateContext(c.env);
    const { WidgetRepository } = await import('@ai-agent/database');
    const widgetRepo = new WidgetRepository(db as any);

    // If token provided, verify it; otherwise use tenantId from query param (for widget sessions)
    let tenantId = '';
    if (widgetToken) {
      const widget = await widgetRepo.findByIdUnscoped(widgetToken);
      if (!widget) {
        return c.text('Invalid widget token', 403);
      }
      tenantId = widget.tenantId;
    } else if (queryTenantId) {
      // For widget sessions without token, use tenantId from session creation
      tenantId = queryTenantId;
    }

    let doId;
    try {
      doId = c.env.SESSION_DO.idFromString(sessionId);
    } catch {
      doId = c.env.SESSION_DO.idFromName(sessionId);
    }
    const stub = c.env.SESSION_DO.get(doId);
    const doReq = new Request(c.req.url, {
      method: c.req.method,
      headers: {
        ...Object.fromEntries(c.req.raw.headers.entries()),
        'X-Internal-Auth': c.env.INTERNAL_API_SECRET,
        'X-Tenant-Id': tenantId,
      },
      body: c.req.raw.body,
    });
    return stub.fetch(doReq);
  } catch {
    return c.text('Authentication failed', 403);
  }
});

app.all('/twilio/media', async (c) => {
  const twilioAuthToken = c.env.TWILIO_AUTH_TOKEN;
  if (!twilioAuthToken) {
    return c.json({ success: false, error: { code: 'CONFIGURATION_ERROR', message: 'Twilio not configured' } }, 403);
  }

  const callSid = c.req.query('CallSid') || 'twilio-default';
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }

  // Validate Twilio webhook signature if TWILIO_AUTH_TOKEN is configured
  const twilioSignature = c.req.header('X-Twilio-Signature');
  if (!twilioSignature) {
    return c.text('Missing Twilio signature', 403);
  }
  // Validate the request URL and signature
  const requestUrl = c.req.url;
  const params = new URL(requestUrl).searchParams;
  const sortedParams = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  let dataStr = requestUrl;
  for (const [key, value] of sortedParams) {
    dataStr += key + value;
  }
  const encoder = new TextEncoder();
  const keyData = encoder.encode(twilioAuthToken);
  const data = encoder.encode(dataStr);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signatureBytes = await crypto.subtle.sign('HMAC', cryptoKey, data);
  const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
  if (computedSignature !== twilioSignature) {
    return c.text('Invalid Twilio signature', 403);
  }

  // Look up phone number to get tenantId for internal auth
  const { db } = getOrCreateContext(c.env);
  const { PhoneNumberRepository } = await import('@ai-agent/database');
  const phoneRepo = new PhoneNumberRepository(db as any);
  const toNumber = c.req.query('To') ?? '';
  const phoneRecord = await phoneRepo.findByPhoneNumber(toNumber);
  const tenantId = phoneRecord?.tenantId ?? callSid;

  let doId;
  try {
    doId = c.env.SESSION_DO.idFromString(callSid);
  } catch {
    doId = c.env.SESSION_DO.idFromName(callSid);
  }
  const stub = c.env.SESSION_DO.get(doId);
  const doReq = new Request(c.req.url, {
    method: c.req.method,
    headers: {
      ...Object.fromEntries(c.req.raw.headers.entries()),
      'X-Internal-Auth': c.env.INTERNAL_API_SECRET,
      'X-Tenant-Id': tenantId,
    },
    body: c.req.raw.body,
  });
  return stub.fetch(doReq);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      requestId: c.get('requestId'),
    },
  }, 404);
});

// Error handler
app.onError((err, c) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, requestId: c.get('requestId') });
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: c.env.ENVIRONMENT === 'development' ? err.message : 'Internal server error',
      requestId: c.get('requestId'),
    },
  }, 500);
});

export default app;
