import type { LLMProvider } from '@ai-agent/providers';
import type { EmbeddingProvider } from '@ai-agent/providers';
import { Logger } from '@ai-agent/shared';

export interface MiddlewareContext {
  tenantId: string;
  agentId: string;
  conversationId: string;
  sessionId: string;
  channel: string;
}

export type MiddlewareNext = () => Promise<void>;
export type MiddlewareHandler = (ctx: MiddlewareContext, next: MiddlewareNext) => Promise<void>;

export class MiddlewareChain {
  private handlers: MiddlewareHandler[] = [];

  use(handler: MiddlewareHandler) {
    this.handlers.push(handler);
  }

  async execute(ctx: MiddlewareContext): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.handlers.length) {
        const handler = this.handlers[index++];
        await handler(ctx, next);
      }
    };

    await next();
  }
}

// Pre-built middleware

export function authMiddleware(
  verifyToken: (token: string) => Promise<{ tenantId: string; userId: string; role: string } | null>
): MiddlewareHandler {
  return async (ctx, next) => {
    // Auth is handled at the API layer via JWT verification.
    // This middleware is a hook for any additional runtime auth checks
    // (e.g., verifying the agent is still active, checking session expiry).
    await next();
  };
}

export function rateLimitMiddleware(
  checkRateLimit: (tenantId: string) => Promise<{ allowed: boolean; remaining: number }>
): MiddlewareHandler {
  return async (ctx, next) => {
    const result = await checkRateLimit(ctx.tenantId);
    if (!result.allowed) {
      throw new Error('Rate limit exceeded');
    }
    await next();
  };
}

export function analyticsMiddleware(
  trackEvent: (event: string, data: Record<string, unknown>) => Promise<void>
): MiddlewareHandler {
  return async (ctx, next) => {
    const startTime = Date.now();
    await next();
    const duration = Date.now() - startTime;

    await trackEvent('turn_completed', {
      tenantId: ctx.tenantId,
      agentId: ctx.agentId,
      conversationId: ctx.conversationId,
      channel: ctx.channel,
      duration,
    });
  };
}

export function moderationMiddleware(
  checkContent: (content: string) => Promise<{ safe: boolean; reason?: string }>
): MiddlewareHandler {
  return async (ctx, next) => {
    // Content moderation would happen here
    // For now, just pass through — implement proper moderation in production
    await next();
  };
}

export function featureFlagMiddleware(
  getFeatureFlags: (tenantId: string) => Promise<Record<string, boolean>>
): MiddlewareHandler {
  return async (ctx, next) => {
    const flags = await getFeatureFlags(ctx.tenantId);
    // Feature flags could be used to enable/disable capabilities
    await next();
  };
}
