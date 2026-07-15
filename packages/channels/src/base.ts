import type { RuntimeEvent } from '@ai-agent/agent';

export interface ChannelMessage {
  id: string;
  type: 'text' | 'audio' | 'image' | 'file';
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface ChannelSession {
  id: string;
  tenantId: string;
  agentId: string;
  conversationId: string;
  channel: string;
  status: 'active' | 'ended' | 'expired';
  createdAt: Date;
  lastActivityAt: Date;
}

export interface ChannelAdapter {
  readonly name: string;

  createSession(params: {
    tenantId: string;
    agentId: string;
    conversationId: string;
  }): Promise<ChannelSession>;

  sendMessage(sessionId: string, message: ChannelMessage): Promise<void>;

  endSession(sessionId: string): Promise<void>;

  onMessage(handler: (sessionId: string, message: ChannelMessage) => void | Promise<void>): void;

  onEvent(handler: (event: RuntimeEvent) => void | Promise<void>): void;
}
