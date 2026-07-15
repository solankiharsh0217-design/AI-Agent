import { eq, and, desc, sql } from 'drizzle-orm';
import { calls } from '../schema/calls';
import { phoneNumbers } from '../schema/phone-numbers';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { generateId } from '../helpers';

export class PhoneNumberRepository {
  constructor(private db: DrizzleD1Database) {}

  async findByPhoneNumber(phoneNumber: string, tenantId?: string) {
    if (tenantId) {
      const row = await this.db.select().from(phoneNumbers).where(and(eq(phoneNumbers.phoneNumber, phoneNumber), eq(phoneNumbers.tenantId, tenantId)));
      return row[0] ?? null;
    }
    const row = await this.db.select().from(phoneNumbers).where(eq(phoneNumbers.phoneNumber, phoneNumber));
    return row[0] ?? null;
  }

  async create(data: { tenantId: string; phoneNumber: string; friendlyName?: string; provider?: string; capabilities?: Record<string, unknown>; monthlyCost?: number; providerReference?: string }) {
    const id = generateId();
    const now = new Date();
    await this.db.insert(phoneNumbers).values({
      id,
      tenantId: data.tenantId,
      phoneNumber: data.phoneNumber,
      friendlyName: data.friendlyName ?? null,
      provider: data.provider ?? 'twilio',
      capabilities: data.capabilities ?? { voice: true, sms: false },
      monthlyCost: data.monthlyCost ?? 0,
      providerReference: data.providerReference ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(id, data.tenantId);
  }

  async findById(id: string, tenantId: string) {
    const row = await this.db.select().from(phoneNumbers).where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.tenantId, tenantId)));
    return row[0] ?? null;
  }

  async findByTenantId(tenantId: string) {
    return this.db.select().from(phoneNumbers)
      .where(eq(phoneNumbers.tenantId, tenantId))
      .orderBy(desc(phoneNumbers.createdAt));
  }

  async assignAgent(id: string, tenantId: string, agentId: string) {
    await this.db.update(phoneNumbers).set({ agentId, status: 'assigned', updatedAt: new Date() }).where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }

  async release(id: string, tenantId: string) {
    await this.db.update(phoneNumbers).set({ agentId: null, status: 'released', updatedAt: new Date() }).where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }
}

export class CallRepository {
  constructor(private db: DrizzleD1Database) {}

  async create(data: { id?: string; tenantId: string; phoneNumberId: string; agentId?: string; direction: string; from: string; to: string }) {
    const id = data.id ?? generateId();
    const now = new Date();
    await this.db.insert(calls).values({
      id,
      tenantId: data.tenantId,
      phoneNumberId: data.phoneNumberId,
      agentId: data.agentId ?? null,
      direction: data.direction as any,
      from: data.from,
      to: data.to,
      createdAt: now,
    });
    return this.findById(id, data.tenantId);
  }

  async findById(id: string, tenantId: string) {
    const row = await this.db.select().from(calls).where(and(eq(calls.id, id), eq(calls.tenantId, tenantId)));
    return row[0] ?? null;
  }

  async findByTenantId(tenantId: string) {
    return this.db.select().from(calls)
      .where(eq(calls.tenantId, tenantId))
      .orderBy(desc(calls.createdAt));
  }

  async findByPhoneNumberId(phoneNumberId: string, tenantId: string) {
    return this.db.select().from(calls)
      .where(and(eq(calls.phoneNumberId, phoneNumberId), eq(calls.tenantId, tenantId)))
      .orderBy(desc(calls.createdAt));
  }

  async updateStatus(id: string, tenantId: string, status: string, data?: { duration?: number; recordingUrl?: string; cost?: number }) {
    const update: Record<string, unknown> = { status, updatedAt: new Date() };
    if (status === 'in-progress') update.startedAt = new Date();
    if (status === 'completed' || status === 'failed' || status === 'no-answer') update.endedAt = new Date();
    if (data?.duration !== undefined) update.duration = data.duration;
    if (data?.recordingUrl) update.recordingUrl = data.recordingUrl;
    if (data?.cost !== undefined) update.cost = data.cost;
    await this.db.update(calls).set(update).where(and(eq(calls.id, id), eq(calls.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }
}
