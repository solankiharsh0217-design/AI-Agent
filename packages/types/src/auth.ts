import { z } from 'zod';
import { UserRole } from './core';

export const ClerkUser = z.object({
  id: z.string(),
  emailAddresses: z.array(z.object({
    id: z.string(),
    emailAddress: z.string().email(),
    primary: z.boolean(),
  })).default([]),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  publicMetadata: z.record(z.unknown()).default({}),
  privateMetadata: z.record(z.unknown()).default({}),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ClerkUser = z.infer<typeof ClerkUser>;

export const ClerkOrganization = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  publicMetadata: z.record(z.unknown()).default({}),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ClerkOrganization = z.infer<typeof ClerkOrganization>;

export const ClerkOrganizationMembership = z.object({
  id: z.string(),
  organization: ClerkOrganization,
  role: z.enum(['org:admin', 'org:member', 'org:billing_manager']).default('org:member'),
  publicUserData: z.object({
    userId: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    emailAddress: z.string().email(),
  }),
});
export type ClerkOrganizationMembership = z.infer<typeof ClerkOrganizationMembership>;

export const AuthTokenPayload = z.object({
  sub: z.string(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  role: UserRole,
  permissions: z.array(z.string()),
  sessionId: z.string().nullable(),
  widgetId: z.string().uuid().nullable(),
  agentId: z.string().uuid().nullable(),
  type: z.enum(['dashboard', 'widget', 'api', 'phone']),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
});
export type AuthTokenPayload = z.infer<typeof AuthTokenPayload>;

export const WidgetTokenPayload = z.object({
  sub: z.string().uuid(),
  tenantId: z.string().uuid(),
  widgetId: z.string().uuid(),
  agentId: z.string().uuid().nullable(),
  conversationId: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  permissions: z.array(z.enum(['chat', 'voice', 'session.create', 'session.read'])).default(['chat']),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
});
export type WidgetTokenPayload = z.infer<typeof WidgetTokenPayload>;

export const APIKey = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  keyHash: z.string(),
  keyPrefix: z.string(),
  permissions: z.array(z.string()).default([]),
  lastUsedAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
  revokedAt: z.date().nullable(),
});
export type APIKey = z.infer<typeof APIKey>;

export const SessionData = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  widgetId: z.string().uuid().nullable(),
  agentId: z.string().uuid().nullable(),
  conversationId: z.string().uuid().nullable(),
  channel: z.enum(['chat', 'voice', 'phone', 'api', 'widget']),
  status: z.enum(['active', 'ended', 'expired', 'error']).default('active'),
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date(),
});
export type SessionData = z.infer<typeof SessionData>;

export const AuditLog = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().nullable(),
  oldValues: z.record(z.unknown()).nullable(),
  newValues: z.record(z.unknown()).nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.date(),
});
export type AuditLog = z.infer<typeof AuditLog>;
