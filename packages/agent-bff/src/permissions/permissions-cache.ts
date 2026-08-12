import type { ActionPermissions, UserPermissionV4 } from '@forestadmin/forestadmin-client';

export const PERMISSIONS_CACHE_TTL_MS = 15 * 60 * 1000;

export interface PermissionsCacheOptions {
  now?: () => number;
  ttlMs?: number;
}

export interface EvaluatedPermissions {
  actionPermissions: ActionPermissions;
  users: UserPermissionV4[];
}

interface CacheEntry {
  permissions: EvaluatedPermissions;
  storedAt: number;
}

export default class PermissionsCache {
  private readonly now: () => number;
  private readonly ttlMs: number;

  private entry: CacheEntry | undefined;

  private readonly rejectedUserIds = new Set<number>();

  constructor({ now = Date.now, ttlMs = PERMISSIONS_CACHE_TTL_MS }: PermissionsCacheOptions = {}) {
    this.now = now;
    this.ttlMs = ttlMs;
  }

  wasRejectedByLatestFetch(userId: number): boolean {
    return this.rejectedUserIds.has(userId);
  }

  rememberRejected(userId: number): void {
    this.rejectedUserIds.add(userId);
  }

  getFresh(): EvaluatedPermissions | undefined {
    if (!this.entry) return undefined;

    if (this.now() - this.entry.storedAt >= this.ttlMs) {
      this.entry = undefined;

      return undefined;
    }

    return this.entry.permissions;
  }

  set(permissions: EvaluatedPermissions): void {
    this.entry = { permissions, storedAt: this.now() };
    this.rejectedUserIds.clear();
  }

  get size(): number {
    return this.entry ? 1 : 0;
  }

  clear(): void {
    this.entry = undefined;
    this.rejectedUserIds.clear();
  }
}
