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

// Is the request Origin allowed by this widget's configured domain allow-list?
// Entries may be bare hosts ("example.com"), full origins ("https://example.com"),
// URLs with a path, "*" (any), or "*.example.com" (any subdomain). Matching is by host.
function widgetOriginAllowed(allowedDomains: unknown, origin: string | undefined): boolean {
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

  let originHost: string;
  try {
    originHost = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }

  return domainsList.some(d => {
    // Normalize an entry to a bare host: strip scheme and any path/query.
    const allowed = d.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '');
    if (!allowed) return false;
    if (allowed === '*') return true;
    if (allowed === originHost) return true;
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(2);
      return originHost.endsWith(suffix) && originHost.length > suffix.length;
    }
    return false;
  });
}

function validateWidgetDomain(allowedDomains: unknown, origin: string | undefined, widgetToken?: string): boolean {
  // Allow if a widget token is provided (for iframe contexts where Origin may be null)
  if (widgetToken) return true;
  return widgetOriginAllowed(allowedDomains, origin);
}

// Encode binary audio to base64 in chunks (avoids call-stack overflow on large buffers)
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

// Per-widget dynamic CORS. Unlike the dashboard API (fixed ALLOWED_ORIGINS), a widget
// is embedded on arbitrary customer sites, so we reflect the request Origin only when it
// matches that widget's own configured `domains` allow-list. Also answers preflight.
widgetsPublic.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  if (origin) {
    // Check if the origin is one of our system allowed origins (e.g., widget host, dashboard host)
    const systemAllowed = c.env.ALLOWED_ORIGINS?.split(',').map((s: string) => s.trim()).filter(Boolean) ?? [];
    if (systemAllowed.includes(origin)) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Vary', 'Origin');
      c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, X-Parent-Origin');
      c.header('Access-Control-Max-Age', '86400');
    } else {
      const match = c.req.path.match(/^\/api\/widgets\/([^/]+)/);
      const id = match?.[1];
      if (id) {
        try {
          const { db } = getOrCreateContext(c.env);
          const { WidgetRepository } = await import('@ai-agent/database');
          const widget = await new WidgetRepository(db as any).findByIdUnscoped(id);
          if (widget && widgetOriginAllowed(widget.domains, origin)) {
            c.header('Access-Control-Allow-Origin', origin);
            c.header('Vary', 'Origin');
            c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, X-Parent-Origin');
            c.header('Access-Control-Max-Age', '86400');
          }
        } catch {
          // On lookup failure, emit no CORS headers — the browser will block, which is safe.
        }
      }
    }
  }
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  await next();
});

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

  const origin = c.req.header('X-Parent-Origin') || c.req.query('parentUrl') || c.req.header('Origin') || c.req.header('Referer');
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

  const origin = c.req.header('X-Parent-Origin') || c.req.query('parentUrl') || c.req.header('Origin') || c.req.header('Referer');
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

  const origin = c.req.header('X-Parent-Origin') || c.req.query('parentUrl') || c.req.header('Origin') || c.req.header('Referer');
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
  const doRes = await stub.fetch(new Request(`${c.req.url.split('/api/widgets')[0]}/messages?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content, widgetId: c.req.param('id') }),
  }));
  return c.body(doRes.body as any, doRes.status as any, Object.fromEntries(doRes.headers));
});

// POST /api/widgets/:id/voice (Voice turn: audio in → transcript + reply text + reply audio)
// Kept below the global 10MB body limit to leave headroom for multipart overhead.
const MAX_VOICE_AUDIO_BYTES = 8 * 1024 * 1024; // 8 MB

widgetsPublic.post('/:id/voice', async (c) => {
  const db = c.get('db');
  const registry = c.get('registry');
  const id = c.req.param('id');
  const { WidgetRepository } = await import('@ai-agent/database');
  const repo = new WidgetRepository(db as any);
  const widget = await repo.findByIdUnscoped(id);
  if (!widget) {
    return c.json({ success: false, error: { code: 'WIDGET_NOT_FOUND', message: 'Widget not found' } }, 404);
  }

  const origin = c.req.header('X-Parent-Origin') || c.req.query('parentUrl') || c.req.header('Origin') || c.req.header('Referer');
  const widgetToken = c.req.query('token') || c.req.header('Authorization')?.slice(7);
  if (!validateWidgetDomain(widget.domains, origin, widgetToken)) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED_DOMAIN', message: 'Domain not whitelisted' } }, 403);
  }

  // Parse multipart form (audio blob + sessionId)
  const form = await c.req.formData().catch(() => null);
  if (!form) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Expected multipart/form-data' } }, 400);
  }
  const sessionId = (form.get('sessionId') as string | null) || c.req.query('sessionId');
  const audioFile = form.get('audio');
  if (!sessionId || !audioFile || typeof audioFile === 'string') {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'sessionId and audio are required' } }, 400);
  }

  const audioBuffer = await (audioFile as Blob).arrayBuffer();
  if (audioBuffer.byteLength === 0 || audioBuffer.byteLength > MAX_VOICE_AUDIO_BYTES) {
    return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'audio must be between 1 byte and 8MB' } }, 400);
  }
  const mimeType = (audioFile as Blob).type || 'audio/webm';

  // Voice settings from widget config (falls back to provider defaults)
  const widgetConfig = typeof widget.config === 'string' ? JSON.parse(widget.config) : (widget.config || {});
  const voiceCfg = (widgetConfig.voice || {}) as { language?: string; voiceId?: string | null; speed?: number };
  const language = (form.get('language') as string | null) || voiceCfg.language || 'en-IN';

  // Transcribe-only mode: used by chatbot widgets where the mic just fills the
  // text input (STT input) and the reply stays as text — no agent turn, no TTS.
  const transcribeOnly = form.get('transcribeOnly') === '1' || form.get('transcribeOnly') === 'true' || c.req.query('transcribeOnly') === '1' || c.req.query('transcribeOnly') === 'true';

  // 1) Speech-to-text
  let transcript = '';
  try {
    const stt = registry.getSTT();
    const sttResult = await stt.transcribe({ audio: new Uint8Array(audioBuffer), mimeType, language });
    transcript = (sttResult.text || '').trim();
  } catch (err) {
    return c.json({ success: false, error: { code: 'STT_ERROR', message: (err as Error).message } }, 502);
  }
  if (!transcript) {
    return c.json({ success: false, error: { code: 'NO_SPEECH', message: 'No speech detected. Please try again.' } }, 422);
  }

  if (transcribeOnly) {
    return c.json({ success: true, data: { transcript } });
  }

  // 2) Run the agent turn via the Session Durable Object (reuses the text pipeline)
  let doId;
  try {
    doId = c.env.SESSION_DO.idFromString(sessionId);
  } catch {
    doId = c.env.SESSION_DO.idFromName(sessionId);
  }
  const stub = c.env.SESSION_DO.get(doId);
  const doBase = c.req.url.split('/api/widgets')[0];
  const doRes = await stub.fetch(new Request(`${doBase}/messages?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Auth': c.env.INTERNAL_API_SECRET,
      'X-Tenant-Id': widget.tenantId,
    },
    body: JSON.stringify({ content: transcript, widgetId: id }),
  }));
  const doJson = (await doRes.json().catch(() => null)) as
    | { success: boolean; data?: { id: string; content: string; timestamp: number }; error?: { message?: string } }
    | null;
  if (!doRes.ok || !doJson?.success || !doJson.data) {
    const message = doJson?.error?.message || 'Failed to generate a response';
    return c.json({ success: false, error: { code: 'RUNTIME_ERROR', message }, data: { transcript } }, 502);
  }
  const replyText = doJson.data.content;

  // 3) Text-to-speech (non-fatal: fall back to text-only if it fails)
  let audioBase64: string | null = null;
  let audioFormat = 'wav';
  try {
    const tts = registry.getTTS();
    const ttsResult = await tts.synthesize({
      text: replyText,
      voiceId: voiceCfg.voiceId ?? undefined,
      language,
      speed: voiceCfg.speed ?? 1.0,
      outputFormat: 'wav',
    });
    audioBase64 = uint8ToBase64(ttsResult.audio);
    audioFormat = ttsResult.format.encoding || 'wav';
  } catch (err) {
    // TTS failed — client still shows the text reply
    console.error('[voice] TTS synthesis failed:', (err as Error).message);
  }

  return c.json({
    success: true,
    data: {
      transcript,
      reply: { id: doJson.data.id, content: replyText, timestamp: doJson.data.timestamp },
      audio: audioBase64,
      audioFormat,
    },
  });
});

  // POST /api/widgets/:id/voice/stream (Streaming voice: audio in → transcript → streaming LLM → streaming TTS via SSE)
  widgetsPublic.post('/:id/voice/stream', async (c) => {
    const db = c.get('db');
    const registry = c.get('registry');
    const widgetId = c.req.param('id');
    const { WidgetRepository } = await import('@ai-agent/database');
    const repo = new WidgetRepository(db as any);
    const widget = await repo.findByIdUnscoped(widgetId);
    if (!widget) {
      return c.json({ success: false, error: { code: 'WIDGET_NOT_FOUND', message: 'Widget not found' } }, 404);
    }

    const origin = c.req.header('X-Parent-Origin') || c.req.query('parentUrl') || c.req.header('Origin') || c.req.header('Referer');
    const widgetToken = c.req.query('token') || c.req.header('Authorization')?.slice(7);
    if (!validateWidgetDomain(widget.domains, origin, widgetToken)) {
      return c.json({ success: false, error: { code: 'UNAUTHORIZED_DOMAIN', message: 'Domain not whitelisted' } }, 403);
    }

    // Parse multipart form (audio blob + sessionId)
    const form = await c.req.formData().catch(() => null);
    if (!form) {
      return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Expected multipart/form-data' } }, 400);
    }
    const sessionId = (form.get('sessionId') as string | null) || c.req.query('sessionId');
    const audioFile = form.get('audio');
    if (!sessionId || !audioFile || typeof audioFile === 'string') {
      return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'sessionId and audio are required' } }, 400);
    }

    const audioBuffer = await (audioFile as Blob).arrayBuffer();
    if (audioBuffer.byteLength === 0 || audioBuffer.byteLength > MAX_VOICE_AUDIO_BYTES) {
      return c.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'audio must be between 1 byte and 8MB' } }, 400);
    }
    const mimeType = (audioFile as Blob).type || 'audio/webm';

    // Voice settings from widget config
    const widgetConfig = typeof widget.config === 'string' ? JSON.parse(widget.config) : (widget.config || {});
    const voiceCfg = (widgetConfig.voice || {}) as { language?: string; voiceId?: string | null; speed?: number };
    const language = (form.get('language') as string | null) || voiceCfg.language || 'en-IN';

    // 1) Speech-to-text
    let transcript = '';
    try {
      const stt = registry.getSTT();
      const sttResult = await stt.transcribe({ audio: new Uint8Array(audioBuffer), mimeType, language });
      transcript = (sttResult.text || '').trim();
    } catch (err) {
      return c.json({ success: false, error: { code: 'STT_ERROR', message: (err as Error).message } }, 502);
    }
    if (!transcript) {
      return c.json({ success: false, error: { code: 'NO_SPEECH', message: 'No speech detected. Please try again.' } }, 422);
    }

    // 2) Stream from Session DO (SSE)
    let doId;
    try {
      doId = c.env.SESSION_DO.idFromString(sessionId);
    } catch {
      doId = c.env.SESSION_DO.idFromName(sessionId);
    }
    const stub = c.env.SESSION_DO.get(doId);
    const doBase = c.req.url.split('/api/widgets')[0];
    const doRes = await stub.fetch(new Request(`${doBase}/stream-messages?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': c.env.INTERNAL_API_SECRET,
        'X-Tenant-Id': widget.tenantId,
      },
      body: JSON.stringify({
        content: transcript,
        widgetId,
        voice: voiceCfg,
      }),
    }));

    // 3) Proxy the SSE stream back to widget.
    // The widget runs inside an iframe on the widget host, so the browser's *request*
    // `Origin` is the widget host — NOT the embedding site. The embedding site is passed
    // separately via `X-Parent-Origin` and is only used to *authorize* the request
    // (validateWidgetDomain above). The CORS `Access-Control-Allow-Origin` header MUST
    // reflect the actual request Origin (matching what the browser enforces), otherwise
    // the browser blocks the streamed body and the widget sees "could not reach voice
    // service". Mirror the per-widget middleware: allow when the request Origin is a
    // system origin OR the widget's domain allow-list matches the *embedding* origin
    // (X-Parent-Origin).
    const corsHeaders: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    };
    const requestOrigin = c.req.header('Origin');
    const systemAllowed = c.env.ALLOWED_ORIGINS?.split(',').map((s: string) => s.trim()).filter(Boolean) ?? [];
    const originAllowed =
      !!requestOrigin &&
      (systemAllowed.includes(requestOrigin) || widgetOriginAllowed(widget.domains, origin));
    if (originAllowed) {
      corsHeaders['Access-Control-Allow-Origin'] = requestOrigin!;
      corsHeaders['Vary'] = 'Origin';
      corsHeaders['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
      corsHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Request-Id, X-Parent-Origin';
      corsHeaders['Access-Control-Max-Age'] = '86400';
    }

    return new Response(doRes.body, { headers: corsHeaders });
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

  // Twilio Media Streams do NOT send X-Twilio-Signature on the WS upgrade, so we
  // authenticate with an HMAC token bound to the CallSid that our (signature-verified)
  // voice webhook issued and embedded in the <Stream> URL.
  const { verifyCallToken } = await import('./twilio-stream-token');
  const token = c.req.query('token');
  const tokenValid = await verifyCallToken(c.env.INTERNAL_API_SECRET, callSid, token ?? undefined);
  if (!tokenValid) {
    return c.text('Invalid or missing stream token', 403);
  }

  // The webhook embeds the tenantId in the stream URL; fall back to a phone-number
  // lookup for older/manual streams.
  let tenantId = c.req.query('tenantId') ?? '';
  if (!tenantId) {
    const { db } = getOrCreateContext(c.env);
    const { PhoneNumberRepository } = await import('@ai-agent/database');
    const phoneRepo = new PhoneNumberRepository(db as any);
    const toNumber = c.req.query('To') ?? '';
    const phoneRecord = await phoneRepo.findByPhoneNumber(toNumber);
    tenantId = phoneRecord?.tenantId ?? callSid;
  }

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
