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
  rejectedUserIds: Set<number>;
}

function sameUsers(previous: UserPermissionV4[], next: UserPermissionV4[]): boolean {
  if (previous.length !== next.length) return false;

  const previousRoleById = new Map(previous.map(user => [user.id, user.roleId]));

  return next.every(user => previousRoleById.get(user.id) === user.roleId);
}

export default class PermissionsCache {
  private readonly now: () => number;
  private readonly ttlMs: number;

  private entry: CacheEntry | undefined;
  private generationValue = 0;

  constructor({ now = Date.now, ttlMs = PERMISSIONS_CACHE_TTL_MS }: PermissionsCacheOptions = {}) {
    this.now = now;
    this.ttlMs = ttlMs;
  }

  wasRejectedByLatestFetch(userId: number): boolean {
    return this.getFreshEntry()?.rejectedUserIds.has(userId) ?? false;
  }

  rememberRejected(userId: number): void {
    this.getFreshEntry()?.rejectedUserIds.add(userId);
  }

  getFresh(): EvaluatedPermissions | undefined {
    return this.getFreshEntry()?.permissions;
  }

  /**
   * The generation a fetch must be started against. Read it before the fetch and hand it back to
   * `set`, so a response that crossed a `clear()` cannot become the shared entry.
   */
  get generation(): number {
    return this.generationValue;
  }

  /**
   * Store a fetched payload, unless a `clear()` landed while the fetch was in flight: it read the
   * permissions the invalidation declared stale, and with a single shared entry one late write would
   * hand a revoked access to every caller for a full TTL.
   */
  set(permissions: EvaluatedPermissions, generation: number): void {
    if (generation !== this.generationValue) return;

    const previous = this.getFreshEntry();
    const carriesTheSameUsers =
      previous !== undefined && sameUsers(previous.permissions.users, permissions.users);

    this.entry = {
      permissions,
      storedAt: this.now(),
      rejectedUserIds: carriesTheSameUsers ? previous.rejectedUserIds : new Set<number>(),
    };
  }

  get size(): number {
    return this.entry ? 1 : 0;
  }

  clear(): void {
    this.entry = undefined;
    this.generationValue += 1;
  }

  private getFreshEntry(): CacheEntry | undefined {
    if (!this.entry) return undefined;

    if (this.now() - this.entry.storedAt >= this.ttlMs) {
      this.entry = undefined;

      return undefined;
    }

    return this.entry;
  }
}
