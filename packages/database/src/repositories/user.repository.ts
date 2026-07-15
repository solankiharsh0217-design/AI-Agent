import { eq, and, isNull, desc } from 'drizzle-orm';
import { users } from '../schema/users';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { generateId } from '../helpers';

export class UserRepository {
  constructor(private db: DrizzleD1Database) {}

  async create(data: { tenantId: string; clerkId: string; email: string; name?: string; role?: string }) {
    const id = generateId();
    const now = new Date();
    await this.db.insert(users).values({
      id,
      tenantId: data.tenantId,
      clerkId: data.clerkId,
      email: data.email,
      name: data.name ?? null,
      role: (data.role as any) ?? 'member',
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(id, data.tenantId);
  }

  async findById(id: string, tenantId: string) {
    const row = await this.db.select().from(users).where(and(eq(users.id, id), eq(users.tenantId, tenantId), isNull(users.deletedAt)));
    return row[0] ?? null;
  }

  async findByClerkId(clerkId: string) {
    const row = await this.db.select().from(users).where(and(eq(users.clerkId, clerkId), isNull(users.deletedAt)));
    return row[0] ?? null;
  }

  async findByTenantId(tenantId: string) {
    return this.db.select().from(users).where(and(eq(users.tenantId, tenantId), isNull(users.deletedAt))).orderBy(desc(users.createdAt));
  }

  async update(id: string, tenantId: string, data: Partial<{ name: string; role: 'owner' | 'admin' | 'member' | 'viewer'; status: 'active' | 'inactive' | 'suspended'; avatarUrl: string }>) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    updateData.updatedAt = new Date();
    await this.db.update(users).set(updateData).where(and(eq(users.id, id), eq(users.tenantId, tenantId)));
    return this.findById(id, tenantId);
  }

  async delete(id: string, tenantId: string) {
    await this.db.update(users).set({ deletedAt: new Date() }).where(and(eq(users.id, id), eq(users.tenantId, tenantId)));
  }
}
