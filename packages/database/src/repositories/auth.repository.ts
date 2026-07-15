import { eq, and, isNull, desc } from 'drizzle-orm';
import { apiKeys, auditLogs } from '../schema/auth';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { generateId } from '../helpers';

export class APIKeyRepository {
  constructor(private db: DrizzleD1Database) {}

  async create(data: { tenantId: string; name: string; keyHash: string; keyPrefix: string; permissions?: string[]; expiresAt?: Date }) {
    const id = generateId();
    const now = new Date();
    await this.db.insert(apiKeys).values({
      id,
      tenantId: data.tenantId,
      name: data.name,
      keyHash: data.keyHash,
      keyPrefix: data.keyPrefix,
      permissions: data.permissions ?? [],
      expiresAt: data.expiresAt ?? null,
      createdAt: now,
    });
    return this.findById(id, data.tenantId);
  }

  async findById(id: string, tenantId: string) {
    const row = await this.db.select().from(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)));
    return row[0] ?? null;
  }

  async findByTenantId(tenantId: string) {
    return this.db.select().from(apiKeys)
      .where(eq(apiKeys.tenantId, tenantId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async findByKeyHash(keyHash: string) {
    const row = await this.db.select().from(apiKeys).where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)));
    return row[0] ?? null;
  }

  async revoke(id: string, tenantId: string) {
    await this.db.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)));
  }

  async updateLastUsed(id: string, tenantId: string) {
    await this.db.update(apiKeys).set({ lastUsedAt: new Date() }).where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)));
  }
}

export class AuditLogRepository {
  constructor(private db: DrizzleD1Database) {}

  async create(data: { tenantId: string; userId?: string; action: string; resource: string; resourceId?: string; oldValues?: Record<string, unknown>; newValues?: Record<string, unknown>; ipAddress?: string }) {
    const id = generateId();
    const now = new Date();
    await this.db.insert(auditLogs).values({
      id,
      tenantId: data.tenantId,
      userId: data.userId ?? null,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId ?? null,
      oldValues: data.oldValues ?? null,
      newValues: data.newValues ?? null,
      ipAddress: data.ipAddress ?? null,
      createdAt: now,
    });
    return id;
  }

  async findByTenantId(tenantId: string, { page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit;
    return this.db.select().from(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async findByResource(resource: string, resourceId: string, tenantId: string) {
    const conditions = [eq(auditLogs.resource, resource), eq(auditLogs.resourceId, resourceId), eq(auditLogs.tenantId, tenantId)];
    return this.db.select().from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt));
  }
}
