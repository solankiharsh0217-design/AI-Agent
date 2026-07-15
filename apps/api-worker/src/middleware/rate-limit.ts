import type { Context, Next } from 'hono';
import type { Env } from '../context';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000, // 1 minute
  maxRequests: 100,
};

// In-memory rate limit store as fallback when KV is unavailable
const inMemoryRateLimits = new Map<string, { count: number; resetAt: number }>();
const IN_MEMORY_WINDOW_MS = 60_000;

export function rateLimitMiddleware(config: Partial<RateLimitConfig> = {}) {
  const opts = { ...DEFAULT_CONFIG, ...config };

  return async (c: Context, next: Next) => {
    const env = c.env as Env;
    const tenantId = c.get('tenantId') as string | undefined;
    const identifier = tenantId ?? (c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'anonymous');
    const windowKey = Math.floor(Date.now() / opts.windowMs);
    const key = `ratelimit:${identifier}:${windowKey}`;

    let count = 0;
    let resetAt: number;

    // Use KV for distributed rate limiting across Workers isolates
    if (env.KV) {
      const stored = await env.KV.get(key);
      count = stored ? parseInt(stored, 10) : 0;
      resetAt = (windowKey + 1) * opts.windowMs;

      if (count >= opts.maxRequests) {
        const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
        c.header('X-RateLimit-Limit', String(opts.maxRequests));
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
        c.header('Retry-After', String(retryAfter));
        return c.json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
            retryAfter,
            requestId: c.get('requestId'),
          },
        }, 429);
      }

      // Increment counter with TTL matching the window
      const ttlSeconds = Math.ceil(opts.windowMs / 1000) + 5; // +5s buffer
      await env.KV.put(key, String(count + 1), { expirationTtl: ttlSeconds });
    } else {
      // In-memory fallback when KV is unavailable
      const now = Date.now();
      const memKey = `rate:${identifier}:${windowKey}`;
      const record = inMemoryRateLimits.get(memKey);
      resetAt = (windowKey + 1) * opts.windowMs;

      if (record && record.resetAt > now) {
        if (record.count >= opts.maxRequests) {
          const retryAfter = Math.ceil((record.resetAt - now) / 1000);
          c.header('X-RateLimit-Limit', String(opts.maxRequests));
          c.header('X-RateLimit-Remaining', '0');
          c.header('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));
          c.header('Retry-After', String(retryAfter));
          return c.json({
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests',
              retryAfter,
              requestId: c.get('requestId'),
            },
          }, 429);
        }
        record.count++;
        count = record.count;
      } else {
        inMemoryRateLimits.set(memKey, { count: 1, resetAt: now + IN_MEMORY_WINDOW_MS });
        count = 1;
      }

      // Clean up old entries periodically
      if (inMemoryRateLimits.size > 10_000) {
        for (const [k, v] of inMemoryRateLimits) {
          if (v.resetAt < now) inMemoryRateLimits.delete(k);
        }
      }
    }

    c.header('X-RateLimit-Limit', String(opts.maxRequests));
    c.header('X-RateLimit-Remaining', String(Math.max(0, opts.maxRequests - count - 1)));
    c.header('X-RateLimit-Reset', String(Math.ceil(resetAt! / 1000)));

    await next();
  };
}
