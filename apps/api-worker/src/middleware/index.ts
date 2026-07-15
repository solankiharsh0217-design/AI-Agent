import { Context, Next } from 'hono';
import { generateId } from '@ai-agent/shared';
import type { Env } from '../context';

export async function requestIdMiddleware(c: Context, next: Next) {
  const requestId = c.req.header('X-Request-Id') ?? generateId();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);
  await next();
}

export async function corsMiddleware(c: Context, next: Next) {
  const allowedOrigins = (c.env as Env)?.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
  const origin = c.req.header('Origin') ?? '';

  const isOriginAllowed = origin && allowedOrigins.length > 0 && allowedOrigins.includes(origin);

  // Only set CORS headers if origin is explicitly allowed — never fall back to wildcard
  if (isOriginAllowed) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
    c.header('Access-Control-Max-Age', '86400');
  }

  if (c.req.method === 'OPTIONS') {
    if (!isOriginAllowed) {
      return c.text('', 403 as any);
    }
    return c.text('', 204 as any);
  }

  await next();
}

export async function securityHeadersMiddleware(c: Context, next: Next) {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('X-XSS-Protection', '1; mode=block');

  // HSTS — instruct browsers to always use HTTPS
  if (!(c.env as Env)?.ENVIRONMENT || (c.env as Env)?.ENVIRONMENT === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  await next();
}

export async function loggingMiddleware(c: Context, next: Next) {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const { logger } = await import('../context');
  logger.info(`${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`, {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
    requestId: c.get('requestId'),
  });
}

interface AuthResult {
  tenantId: string;
  userId: string;
  role: string;
  error?: { code: string; message: string; status: number };
}

export async function authMiddleware(authHeader: string | undefined, env: Env): Promise<AuthResult> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { tenantId: '', userId: '', role: '', error: { code: 'AUTH_REQUIRED', message: 'Missing or invalid Authorization header', status: 401 } };
  }

  const token = authHeader.slice(7);

  try {
    // Verify Clerk JWT using JWKS
    const payload = await verifyClerkToken(token, env.CLERK_PUBLISHABLE_KEY, env);
    if (!payload) {
      return { tenantId: '', userId: '', role: '', error: { code: 'AUTH_REQUIRED', message: 'Invalid or expired token', status: 401 } };
    }

    // Extract tenant and user info from JWT claims
    const tenantId = (payload.tenant_id as string) ?? (payload.org_id as string);
    const userId = payload.sub as string;
    const role = (payload.role as string) ?? 'member';

    if (!tenantId) {
      return { tenantId: '', userId: '', role: '', error: { code: 'AUTH_REQUIRED', message: 'No tenant associated with this token', status: 401 } };
    }
    if (!userId) {
      return { tenantId: '', userId: '', role: '', error: { code: 'AUTH_REQUIRED', message: 'No user ID in token', status: 401 } };
    }

    return { tenantId, userId, role };
  } catch (error) {
    return { tenantId: '', userId: '', role: '', error: { code: 'AUTH_REQUIRED', message: 'Token verification failed', status: 401 } };
  }
}

/** Decode Base64URL (JWT standard) to string, handling - and _ characters */
function base64UrlDecode(str: string): string {
  // Replace base64url characters with base64 characters
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  return atob(base64);
}

/** Decode Base64URL to Uint8Array */
function base64UrlToUint8Array(str: string): Uint8Array {
  const decoded = base64UrlDecode(str);
  return Uint8Array.from(decoded, c => c.charCodeAt(0));
}

const JWKS_CACHE_KEY = 'clerk:jwks:cache';
const JWKS_CACHE_TTL = 3600; // 1 hour

async function verifyClerkToken(token: string, clerkPublishableKey: string, env: Env): Promise<Record<string, unknown> | null> {
  // Parse JWT header to get kid
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));

    // Verify algorithm is RS256
    if (header.alg !== 'RS256') return null;

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    // Check not-before
    if (payload.nbf && payload.nbf > Math.floor(Date.now() / 1000) + 60) {
      return null;
    }

    // Compute expected issuer from publishable key
    const keySuffix = clerkPublishableKey.split('_').slice(1).join('_');
    const expectedIssuer = `https://clerk.${keySuffix}.accounts.dev`;

    // Validate issuer — must match expected or be in the known list
    const knownIssuers = [expectedIssuer];
    if (payload.iss && !knownIssuers.includes(payload.iss as string)) {
      return null;
    }

    // Validate audience if present
    if (payload.aud) {
      const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      // Clerk tokens should have the frontend API URL as audience
      const hasValidAudience = audience.includes(expectedIssuer) || audience.includes(clerkPublishableKey);
      if (!hasValidAudience) {
        return null;
      }
    }

    // Fetch Clerk JWKS — use KV cache to avoid per-request fetches
    const issuer = payload.iss as string || expectedIssuer;
    let jwks: { keys: Array<{ kid: string; kty: string; n: string; e: string }> } | null = null;

    // Try KV cache first
    if ((env as any).KV) {
      const cached = await (env as any).KV.get(JWKS_CACHE_KEY);
      if (cached) {
        try { jwks = JSON.parse(cached); } catch { /* ignore */ }
      }
    }

    // Fetch if not cached
    if (!jwks) {
      const jwksUrl = `${issuer}/.well-known/jwks.json`;
      const response = await fetch(jwksUrl);
      if (!response.ok) return null;
      jwks = await response.json() as typeof jwks;

      // Cache in KV
      if ((env as any).KV && jwks) {
        await (env as any).KV.put(JWKS_CACHE_KEY, JSON.stringify(jwks), { expirationTtl: JWKS_CACHE_TTL });
      }
    }

    const key = jwks!.keys.find(k => k.kid === header.kid);
    if (!key) return null;

    // Import the public key
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      { kty: key.kty, n: key.n, e: key.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Verify signature using base64url-decoded signature
    const encoder = new TextEncoder();
    const data = encoder.encode(`${parts[0]}.${parts[1]}`);
    const signature = base64UrlToUint8Array(parts[2]);

    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, data);
    if (!valid) return null;

    return payload;
  } catch {
    return null;
  }
}
