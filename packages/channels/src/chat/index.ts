import type { ChannelAdapter, ChannelMessage, ChannelSession } from '../base';
import type { RuntimeEvent } from '@ai-agent/agent';
import { generateId } from '../helpers';

export interface ChatAdapterConfig {
  enableStreaming?: boolean;
  enableMarkdown?: boolean;
  enableTypingIndicator?: boolean;
}

export class ChatAdapter implements ChannelAdapter {
  readonly name = 'chat';
  private config: ChatAdapterConfig;
  private messageHandlers: Array<(sessionId: string, message: ChannelMessage) => void | Promise<void>> = [];
  private eventHandlers: Array<(event: RuntimeEvent) => void | Promise<void>> = [];
  private sessions: Map<string, ChannelSession> = new Map();

  constructor(config: ChatAdapterConfig = {}) {
    this.config = {
      enableStreaming: true,
      enableMarkdown: true,
      enableTypingIndicator: true,
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
      channel: 'chat',
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

    session.lastActivityAt = new Date();

    // Notify handlers
    for (const handler of this.messageHandlers) {
      await handler(sessionId, message);
    }

    // Dispatch to event handlers
    for (const handler of this.eventHandlers) {
      try {
        await handler({
          id: generateId(),
          type: message.role === 'user' ? 'user_message' : 'assistant_message',
          tenantId: session.tenantId,
          conversationId: session.conversationId,
          sessionId: session.id,
          agentId: session.agentId,
          timestamp: new Date(),
          payload: {
            content: message.content,
            role: message.role as 'user' | 'assistant',
          },
          metadata: message.metadata,
        } as RuntimeEvent);
      } catch (error) {
        console.error('Event handler error', { error: (error as Error).message });
      }
    }
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'ended';
      this.sessions.delete(sessionId);
    }
  }

  onMessage(handler: (sessionId: string, message: ChannelMessage) => void | Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  onEvent(handler: (event: RuntimeEvent) => void | Promise<void>): void {
    this.eventHandlers.push(handler);
  }

  getSession(sessionId: string): ChannelSession | undefined {
    return this.sessions.get(sessionId);
  }

  createMessage(params: {
    type: ChannelMessage['type'];
    content: string;
    role: ChannelMessage['role'];
    metadata?: Record<string, unknown>;
  }): ChannelMessage {
    return {
      id: generateId(),
      type: params.type,
      content: params.content,
      role: params.role,
      timestamp: new Date(),
      metadata: params.metadata ?? {},
    };
  }
}
