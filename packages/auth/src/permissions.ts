import { ForbiddenError } from '@ai-agent/shared';

export const ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'create:agent',
  'update:agent',
  'delete:agent',
  'publish:agent',
  'create:knowledge',
  'delete:knowledge',
  'create:widget',
  'update:widget',
  'view:analytics',
  'manage:billing',
  'manage:phone',
  'manage:team',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const rolePermissions: Record<Role, Permission[]> = {
  owner: [...PERMISSIONS],
  admin: [
    'create:agent',
    'update:agent',
    'delete:agent',
    'publish:agent',
    'create:knowledge',
    'delete:knowledge',
    'create:widget',
    'update:widget',
    'view:analytics',
    'manage:phone',
  ],
  member: [
    'create:agent',
    'update:agent',
    'publish:agent',
    'create:knowledge',
    'delete:knowledge',
    'create:widget',
    'update:widget',
    'view:analytics',
  ],
  viewer: ['view:analytics'],
};

export class PermissionChecker {
  hasPermission(role: Role, permission: Permission): boolean {
    const perms = rolePermissions[role];
    if (!perms) return false;
    return perms.includes(permission);
  }

  requirePermission(role: Role, permission: Permission): void {
    if (!this.hasPermission(role, permission)) {
      throw new ForbiddenError(
        `Role "${role}" does not have permission "${permission}"`
      );
    }
  }
}
