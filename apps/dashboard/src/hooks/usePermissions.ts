'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

export type Role = 'owner' | 'admin' | 'member' | 'viewer';
export type Permission =
  | 'create:agent'
  | 'update:agent'
  | 'delete:agent'
  | 'publish:agent'
  | 'create:knowledge'
  | 'delete:knowledge'
  | 'create:widget'
  | 'update:widget'
  | 'view:analytics'
  | 'manage:billing'
  | 'manage:phone'
  | 'manage:team';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ['create:agent', 'update:agent', 'delete:agent', 'publish:agent', 'create:knowledge', 'delete:knowledge', 'create:widget', 'update:widget', 'view:analytics', 'manage:billing', 'manage:phone', 'manage:team'],
  admin: ['create:agent', 'update:agent', 'delete:agent', 'publish:agent', 'create:knowledge', 'delete:knowledge', 'create:widget', 'update:widget', 'view:analytics', 'manage:phone'],
  member: ['create:agent', 'update:agent', 'publish:agent', 'create:knowledge', 'delete:knowledge', 'create:widget', 'update:widget', 'view:analytics'],
  viewer: ['view:analytics'],
};

export function hasPermission(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

let cachedRole: Role | null = null;
const listeners = new Set<(role: Role | null) => void>();

function setCachedRole(role: Role | null) {
  cachedRole = role;
  listeners.forEach((l) => l(role));
}

/** Returns the current user's role and a `can(permission)` helper. */
export function usePermissions() {
  const [role, setRole] = useState<Role | null>(cachedRole);

  useEffect(() => {
    if (cachedRole) {
      setRole(cachedRole);
      return;
    }
    let cancelled = false;
    api.user
      .me()
      .then((u) => {
        if (cancelled) return;
        const r = (u?.role as Role) || null;
        setCachedRole(r);
        setRole(r);
      })
      .catch(() => {});
    const listener = (r: Role | null) => setRole(r);
    listeners.add(listener);
    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, []);

  const can = useCallback((permission: Permission) => hasPermission(role, permission), [role]);

  return { role, can };
}
