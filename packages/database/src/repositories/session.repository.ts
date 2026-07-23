import { eq, and, desc } from 'drizzle-orm';
import { sessions } from '../schema/sessions';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { generateId } from '../helpers';

export class SessionRepository {
  constructor(private db: DrizzleD1Database) {}

  async create(data: { id?: string; tenantId: string; agentId: string; conversationId: string; channel: string; metadata?: Record<string, unknown> }) {
    const id = data.id ?? generateId();
    const now = new Date();
    await this.db.insert(sessions).values({
      id,
      tenantId: data.tenantId,
      agentId: data.agentId,
      conversationId: data.conversationId,
      channel: data.channel as any,
      metadata: data.metadata ?? {},
      state: { messageCount: 0, tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 }, currentTurn: 0, pendingToolCalls: [], context: {} },
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(id, data.tenantId);
  }

  async findById(id: string, tenantId: string) {
    const row = await this.db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.tenantId, tenantId)));
    return row[0] ?? null;
  }

  async findByIdUnscoped(id: string) {
    const row = await this.db.select().from(sessions).where(eq(sessions.id, id));
    return row[0] ?? null;
  }

  async findByTenantId(tenantId: string) {
    return this.db.select().from(sessions)
      .where(eq(sessions.tenantId, tenantId))
      .orderBy(desc(sessions.createdAt));
  }

  async findByAgentId(agentId: string, tenantId: string) {
    return this.db.select().from(sessions)
      .where(and(eq(sessions.agentId, agentId), eq(sessions.tenantId, tenantId)))
      .orderBy(desc(sessions.createdAt));
  }

  async updateState(id: string, tenantId: string, state: Record<string, unknown>) {
    await this.db.update(sessions).set({ state, updatedAt: new Date() }).where(and(eq(sessions.id, id), eq(sessions.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }

  async updateStatus(id: string, tenantId: string, status: 'created' | 'active' | 'listening' | 'thinking' | 'responding' | 'waiting' | 'ended' | 'expired' | 'error') {
    const update: Record<string, unknown> = { status, updatedAt: new Date() };
    if (status === 'ended') update.endedAt = new Date();
    await this.db.update(sessions).set(update).where(and(eq(sessions.id, id), eq(sessions.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }

  async end(id: string, tenantId: string) {
    await this.db.update(sessions).set({ status: 'ended', endedAt: new Date(), updatedAt: new Date() }).where(and(eq(sessions.id, id), eq(sessions.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }
}
