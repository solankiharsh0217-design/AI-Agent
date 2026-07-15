import { APIKeyRepository } from '@ai-agent/database';
import { generateApiKey, hashString } from '@ai-agent/shared';
import { AuthError, NotFoundError } from '@ai-agent/shared';

export interface ApiKeyCreateResult {
  key: string;
  id: string;
  name: string;
  prefix: string;
  expiresAt: Date | null;
}

export class ApiKeyManager {
  private repo: APIKeyRepository;

  constructor(db: { apiKeys: APIKeyRepository }) {
    this.repo = db.apiKeys;
  }

  async createApiKey(
    tenantId: string,
    name: string,
    scopes: string[] = [],
    expiresAt?: Date
  ): Promise<ApiKeyCreateResult> {
    const { key, hash, prefix } = await generateApiKey();

    const apiKey = await this.repo.create({
      tenantId,
      name,
      keyHash: hash,
      keyPrefix: prefix,
      permissions: scopes,
      expiresAt,
    });

    return {
      key,
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.keyPrefix,
      expiresAt: apiKey.expiresAt,
    };
  }

  async validateApiKey(key: string): Promise<{ tenantId: string; permissions: string[] } | null> {
    const keyHash = await hashString(key);
    const apiKey = await this.repo.findByKeyHash(keyHash);

    if (!apiKey) return null;
    if (apiKey.revokedAt) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    await this.repo.updateLastUsed(apiKey.id, apiKey.tenantId);

    return {
      tenantId: apiKey.tenantId,
      permissions: (apiKey.permissions ?? []) as string[],
    };
  }

  async revokeApiKey(keyId: string, tenantId: string): Promise<void> {
    const apiKey = await this.repo.findById(keyId, tenantId);
    if (!apiKey) throw new NotFoundError('API Key', keyId);
    if (apiKey.tenantId !== tenantId) throw new AuthError('Cannot revoke API key for another tenant');

    await this.repo.revoke(keyId, tenantId);
  }

  async listApiKeys(tenantId: string) {
    const keys = await this.repo.findByTenantId(tenantId);
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      permissions: k.permissions,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
      revokedAt: k.revokedAt,
      isActive: !k.revokedAt,
    }));
  }
}
