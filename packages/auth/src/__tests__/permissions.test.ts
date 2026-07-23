import { describe, it, expect } from 'vitest';
import { PermissionChecker, ROLES, PERMISSIONS } from '../permissions';

describe('PermissionChecker', () => {
  const checker = new PermissionChecker();

  it('should grant all permissions to owner role', () => {
    for (const perm of PERMISSIONS) {
      expect(checker.hasPermission('owner', perm)).toBe(true);
    }
  });

  it('should grant admin all permissions except manage:team', () => {
    const adminPerms = [
      'create:agent', 'update:agent', 'delete:agent', 'publish:agent',
      'create:knowledge', 'update:knowledge', 'delete:knowledge',
      'create:widget', 'update:widget', 'delete:widget',
      'view:analytics', 'manage:conversations', 'manage:phone',
    ];
    for (const perm of adminPerms) {
      expect(checker.hasPermission('admin', perm as any)).toBe(true);
    }
    expect(checker.hasPermission('admin', 'manage:billing')).toBe(false);
    expect(checker.hasPermission('admin', 'manage:team')).toBe(false);
  });

  it('should grant member conversation, agent, knowledge, widget permissions', () => {
    expect(checker.hasPermission('member', 'create:agent')).toBe(true);
    expect(checker.hasPermission('member', 'update:agent')).toBe(true);
    expect(checker.hasPermission('member', 'delete:knowledge')).toBe(true);
    expect(checker.hasPermission('member', 'manage:conversations')).toBe(true);
    expect(checker.hasPermission('member', 'delete:agent')).toBe(false);
    expect(checker.hasPermission('member', 'manage:billing')).toBe(false);
  });

  it('should only grant view:analytics and manage:conversations to viewer', () => {
    expect(checker.hasPermission('viewer', 'view:analytics')).toBe(true);
    expect(checker.hasPermission('viewer', 'manage:conversations')).toBe(false);
    expect(checker.hasPermission('viewer', 'create:agent')).toBe(false);
  });

  it('should throw ForbiddenError for missing permission via requirePermission', () => {
    expect(() => checker.requirePermission('viewer', 'create:agent')).toThrow('does not have permission');
  });

  it('should return false for unknown role', () => {
    expect(checker.hasPermission('superadmin' as any, 'view:analytics')).toBe(false);
  });
});

describe('ROLES and PERMISSIONS constants', () => {
  it('should define exactly 4 roles', () => {
    expect(ROLES).toEqual(['owner', 'admin', 'member', 'viewer']);
  });

  it('should include manage:conversations in PERMISSIONS', () => {
    expect(PERMISSIONS).toContain('manage:conversations');
  });
});
