import { SessionRepository, ConversationRepository } from '@ai-agent/database';
import type { ChannelType } from '@ai-agent/types';

export interface SessionState {
  messageCount: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  currentTurn: number;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
  pendingToolCalls: string[];
  context: Record<string, unknown>;
}

export interface CreateSessionParams {
  tenantId: string;
  agentId: string;
  conversationId: string;
  channel: ChannelType;
  metadata?: Record<string, unknown>;
}

export class SessionManager {
  private sessionRepo: SessionRepository;
  private conversationRepo: ConversationRepository;

  constructor(sessionRepo: SessionRepository, conversationRepo: ConversationRepository) {
    this.sessionRepo = sessionRepo;
    this.conversationRepo = conversationRepo;
  }

  async createSession(params: CreateSessionParams): Promise<string> {
    const session = await this.sessionRepo.create({
      tenantId: params.tenantId,
      agentId: params.agentId,
      conversationId: params.conversationId,
      channel: params.channel,
      metadata: params.metadata,
    });

    return session.id;
  }

  async getSession(sessionId: string, tenantId: string) {
    return this.sessionRepo.findById(sessionId, tenantId);
  }

  async updateSessionState(sessionId: string, tenantId: string, state: Partial<SessionState>) {
    const session = await this.sessionRepo.findById(sessionId, tenantId);
    if (!session) throw new Error('Session not found');

    const currentState = session.state as unknown as SessionState;
    const newState = { ...currentState, ...state };

    await this.sessionRepo.updateState(sessionId, tenantId, newState as Record<string, unknown>);
  }

  async endSession(sessionId: string, tenantId: string) {
    await this.sessionRepo.end(sessionId, tenantId);
  }

  async createConversation(params: {
    tenantId: string;
    agentId: string;
    sessionId?: string;
    channel: ChannelType;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const conversation = await this.conversationRepo.create({
      tenantId: params.tenantId,
      agentId: params.agentId,
      sessionId: params.sessionId,
      channel: params.channel,
      metadata: params.metadata,
    });

    return conversation.id;
  }

  async getConversation(conversationId: string, tenantId: string) {
    return this.conversationRepo.findById(conversationId, tenantId);
  }

  async endConversation(conversationId: string, tenantId: string, summary?: string) {
    await this.conversationRepo.end(conversationId, tenantId, summary);
  }

  async addMessage(
    conversationId: string,
    tenantId: string,
    role: string,
    content: string,
    metadata?: Record<string, unknown>,
    tokens?: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number }
  ) {
    return this.conversationRepo.addMessage({
      conversationId,
      tenantId,
      role,
      content,
      metadata,
      tokens,
    });
  }

  async getMessages(conversationId: string, tenantId: string, limit?: number, offset?: number) {
    return this.conversationRepo.getMessages(conversationId, tenantId, { limit, offset });
  }
}
