import { describe, it, expect, beforeEach } from 'vitest';
import { TokenService } from '../token';

describe('TokenService', () => {
  const secret = 'test-secret-key-12345';
  let service: TokenService;

  beforeEach(() => {
    service = new TokenService(secret);
  });

  it('should generate a valid widget token with correct structure', async () => {
    const token = await service.generateWidgetToken('widget-1', 'agent-1', 'tenant-1');
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBeTruthy();
    expect(parts[1]).toBeTruthy();
    expect(parts[2]).toBeTruthy();
  });

  it('should verify a token it generated', async () => {
    const token = await service.generateWidgetToken('widget-1', 'agent-1', 'tenant-1');
    const payload = await service.verifyWidgetToken(token);
    expect(payload.sub).toBe('widget-1');
    expect(payload.agentId).toBe('agent-1');
    expect(payload.tenantId).toBe('tenant-1');
    expect(payload.iss).toBe('ai-agent-platform');
    expect(payload.aud).toBe('widget');
    expect(payload.exp).toBeGreaterThan(0);
    expect(payload.iat).toBeGreaterThan(0);
  });

  it('should reject a token with invalid signature', async () => {
    const token = await service.generateWidgetToken('widget-1', null, 'tenant-1');
    const parts = token.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`;
    await expect(service.verifyWidgetToken(tamperedToken)).rejects.toThrow('Invalid widget token signature');
  });

  it('should reject a token with wrong format', async () => {
    await expect(service.verifyWidgetToken('not-a-jwt')).rejects.toThrow('Invalid widget token format');
    await expect(service.verifyWidgetToken('a.b')).rejects.toThrow('Invalid widget token format');
    await expect(service.verifyWidgetToken('a.b.c.d')).rejects.toThrow('Invalid widget token format');
  });

  it('should reject an expired token', async () => {
    const token = await service.generateWidgetToken('widget-1', null, 'tenant-1', -1000);
    await expect(service.verifyWidgetToken(token)).rejects.toThrow('Widget token has expired');
  });

  it('should reject a token with wrong issuer', async () => {
    const token = await service.generateWidgetToken('widget-1', null, 'tenant-1');
    const parts = token.split('.');
    const decodedPayload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(parts[1].length + (4 - parts[1].length % 4) % 4, '=')));
    decodedPayload.iss = 'attacker';
    const tamperedPayload = btoa(JSON.stringify(decodedPayload));
    const tamperedToken = `${parts[0]}.${tamperedPayload.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.${parts[2]}`;
    await expect(service.verifyWidgetToken(tamperedToken)).rejects.toThrow('Invalid widget token signature');
  });

  it('should generate tokens with custom expiry', async () => {
    const oneHour = 60 * 60 * 1000;
    const token = await service.generateWidgetToken('widget-1', null, 'tenant-1', oneHour);
    const parts = token.split('.');
    const decodedPayload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(parts[1].length + (4 - parts[1].length % 4) % 4, '=')));
    const expectedExp = Math.floor((Date.now() + oneHour) / 1000);
    expect(Math.abs(decodedPayload.exp - expectedExp)).toBeLessThanOrEqual(2);
  });

  it('should throw when constructed without a secret', () => {
    expect(() => new TokenService('')).toThrow('Token secret is required');
  });
});
