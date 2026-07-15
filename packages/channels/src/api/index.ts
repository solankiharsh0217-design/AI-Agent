import type { ChannelAdapter, ChannelMessage, ChannelSession } from '../base';
import type { RuntimeEvent } from '@ai-agent/agent';
import { generateId } from '../helpers';

export interface APIAdapterConfig {
  enableStreaming?: boolean;
  rateLimitPerMinute?: number;
}

export class APIAdapter implements ChannelAdapter {
  readonly name = 'api';
  private config: APIAdapterConfig;
  private messageHandlers: Array<(sessionId: string, message: ChannelMessage) => void | Promise<void>> = [];
  private eventHandlers: Array<(event: RuntimeEvent) => void | Promise<void>> = [];
  private sessions: Map<string, ChannelSession> = new Map();
  private rateLimits: Map<string, number[]> = new Map();

  constructor(config: APIAdapterConfig = {}) {
    this.config = {
      enableStreaming: true,
      rateLimitPerMinute: 60,
      ...config,
    };
  }

  async createSession(params: {
    tenantId: string;
    agentId: string;
    conversationId: string;
  }): Promise<ChannelSession> {
    const session: ChannelSession = {
      id: generateId(),
      tenantId: params.tenantId,
      agentId: params.agentId,
      conversationId: params.conversationId,
      channel: 'api',
      status: 'active',
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async sendMessage(sessionId: string, message: ChannelMessage): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    // Check rate limit
    if (!this.checkRateLimit(session.tenantId).allowed) {
      throw new Error('Rate limit exceeded');
    }

    session.lastActivityAt = new Date();

    for (const handler of this.messageHandlers) {
      await handler(sessionId, message);
    }
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'ended';
      this.sessions.delete(sessionId);
    }
  }

  checkRateLimit(tenantId: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const timestamps = this.rateLimits.get(tenantId) ?? [];
    const recentTimestamps = timestamps.filter(t => now - t < windowMs);

    if (recentTimestamps.length >= this.config.rateLimitPerMinute!) {
      this.rateLimits.set(tenantId, recentTimestamps);
      return { allowed: false, remaining: 0 };
    }

    recentTimestamps.push(now);
    this.rateLimits.set(tenantId, recentTimestamps);

    // Clean up empty entries periodically
    if (this.rateLimits.size > 1000) {
      for (const [key, val] of this.rateLimits) {
        if (val.length === 0) this.rateLimits.delete(key);
      }
    }

    return {
      allowed: true,
      remaining: this.config.rateLimitPerMinute! - recentTimestamps.length,
    };
  }

  onMessage(handler: (sessionId: string, message: ChannelMessage) => void | Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  onEvent(handler: (event: RuntimeEvent) => void | Promise<void>): void {
    this.eventHandlers.push(handler);
  }
}
