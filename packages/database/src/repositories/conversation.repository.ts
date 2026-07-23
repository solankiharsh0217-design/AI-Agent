import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { conversations } from '../schema/conversations';
import { messages } from '../schema/messages';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { generateId } from '../helpers';

export class ConversationRepository {
  constructor(private db: DrizzleD1Database) {}

  async create(data: { tenantId: string; agentId: string; sessionId?: string; channel: string; metadata?: Record<string, unknown> }) {
    const id = generateId();
    const now = new Date();
    await this.db.insert(conversations).values({
      id,
      tenantId: data.tenantId,
      agentId: data.agentId,
      sessionId: data.sessionId ?? null,
      channel: data.channel as any,
      metadata: data.metadata ?? {},
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(id, data.tenantId);
  }

  async findById(id: string, tenantId: string) {
    const row = await this.db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)));
    return row[0] ?? null;
  }

  async findByTenantId(tenantId: string, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const rows = await this.db.select().from(conversations)
      .where(eq(conversations.tenantId, tenantId))
      .orderBy(desc(conversations.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await this.db.select({ count: sql<number>`count(*)` }).from(conversations).where(eq(conversations.tenantId, tenantId));
    const total = countResult[0]?.count ?? 0;

    return { data: rows, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findByAgentId(agentId: string, tenantId: string, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    return this.db.select().from(conversations)
      .where(and(eq(conversations.agentId, agentId), eq(conversations.tenantId, tenantId)))
      .orderBy(desc(conversations.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async end(id: string, tenantId: string, summary?: string) {
    const now = new Date();
    await this.db.update(conversations).set({
      status: 'ended',
      endedAt: now,
      updatedAt: now,
      ...(summary ? { summary } : {}),
    }).where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }

  async incrementMessageCount(id: string, tenantId: string, tokens: number = 0, count: number = 1) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const conditions = [eq(conversations.id, id), eq(conversations.tenantId, tenantId)];
    if (tokens > 0) {
      await this.db.update(conversations).set({
        messageCount: sql`${conversations.messageCount} + ${count}`,
        totalTokens: sql`${conversations.totalTokens} + ${tokens}`,
        ...updates,
      }).where(and(...conditions));
    } else {
      await this.db.update(conversations).set({
        messageCount: sql`${conversations.messageCount} + ${count}`,
        ...updates,
      }).where(and(...conditions));
    }
  }

  async addMessage(data: {
    conversationId: string;
    tenantId: string;
    sessionId?: string;
    role: string;
    content: string;
    type?: string;
    metadata?: Record<string, unknown>;
    toolCalls?: Record<string, unknown>[];
    toolCallId?: string;
    tokens?: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number };
  }) {
    const id = generateId();
    const now = new Date();
    await this.db.insert(messages).values({
      id,
      conversationId: data.conversationId,
      tenantId: data.tenantId,
      sessionId: data.sessionId ?? null,
      role: data.role as any,
      content: data.content,
      type: (data.type as any) ?? 'text',
      metadata: data.metadata ?? {},
      toolCalls: data.toolCalls ?? [],
      toolCallId: data.toolCallId ?? null,
      inputTokens: data.tokens?.inputTokens ?? 0,
      outputTokens: data.tokens?.outputTokens ?? 0,
      totalTokens: data.tokens?.totalTokens ?? 0,
      estimatedCostUsd: data.tokens?.estimatedCostUsd ?? 0,
      createdAt: now,
    });
    return this.db.select().from(messages).where(eq(messages.id, id));
  }

  async getMessages(conversationId: string, tenantId: string, { limit = 50, offset = 0 } = {}) {
    return this.db.select().from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.tenantId, tenantId)))
      .orderBy(messages.createdAt)
      .limit(limit)
      .offset(offset);
  }

  async deleteMessage(id: string, tenantId: string) {
    await this.db.delete(messages).where(and(eq(messages.id, id), eq(messages.tenantId, tenantId)));
  }
}
