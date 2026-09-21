import type { AuditOperation } from './types';

import { ValidationError } from '@forestadmin/datasource-toolkit';
import { DateTime } from 'luxon';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
// ISO 8601 instant: carries its own timezone designator (`Z` or `±HH:mm` / `±HHMM`).
const ISO_INSTANT = /[Zz]$|[+-]\d{2}:?\d{2}$/;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const AUDIT_OPERATIONS: readonly AuditOperation[] = [
  'create',
  'update',
  'delete',
  'action',
  'action_failed',
];

// Comma-separated integer ids; non-numeric tokens are dropped. Empty after parsing → no filter.
export function parseUserIds(raw?: string): number[] | undefined {
  if (!raw) return undefined;

  const ids = raw
    .split(',')
    .map(token => token.trim())
    .filter(token => /^\d+$/.test(token))
    .map(token => Number.parseInt(token, 10));

  return ids.length > 0 ? ids : undefined;
}

// Comma-separated, from a closed set. An unrecognized value is rejected rather than dropped: a
// silently ignored filter returns unfiltered rows into a list the caller believes is filtered,
// which is worse than an error.
export function parseOperations(raw?: string): AuditOperation[] | undefined {
  if (!raw) return undefined;

  const tokens = raw
    .split(',')
    .map(token => token.trim())
    .filter(token => token.length > 0);

  const unknown = tokens.find(token => !AUDIT_OPERATIONS.includes(token as AuditOperation));

  if (unknown) {
    throw new ValidationError(
      `Invalid operation: "${unknown}" (expected one of ${AUDIT_OPERATIONS.join(', ')})`,
    );
  }

  return tokens.length > 0 ? (tokens as AuditOperation[]) : undefined;
}

export function parseFields(raw?: string): string[] | undefined {
  if (!raw) return undefined;

  const fields = raw
    .split(',')
    .map(token => token.trim())
    .filter(token => token.length > 0);

  return fields.length > 0 ? fields : undefined;
}

// Trimmed; empty after trimming is treated the same as absent.
export function parseSearch(raw?: string): string | undefined {
  const trimmed = raw?.trim();

  return trimmed || undefined;
}

// 1-based `page[size]` (default 20, capped at 100). Invalid values fall back to the default rather
// than erroring.
export function parsePageSize(raw?: string): number {
  const size = Number.parseInt(raw ?? '', 10);

  if (Number.isNaN(size) || size < 1) return DEFAULT_PAGE_SIZE;

  return Math.min(size, MAX_PAGE_SIZE);
}

function toLocalInstant(raw: string, timezone: string, boundary: 'start' | 'end'): DateTime {
  // An embedded offset already pins the instant — the request timezone and start/end boundary
  // don't apply.
  if (ISO_INSTANT.test(raw)) return DateTime.fromISO(raw, { setZone: true });

  if (DATE_ONLY.test(raw)) {
    const day = DateTime.fromISO(raw, { zone: timezone });

    return boundary === 'end' ? day.endOf('day') : day.startOf('day');
  }

  const match = DATE_TIME.exec(raw);

  if (!match) return DateTime.invalid('unparsable');

  const [, date, hours, minutes, seconds] = match;
  const base = DateTime.fromISO(`${date}T${hours}:${minutes}`, { zone: timezone });

  if (seconds !== undefined) return base.set({ second: Number(seconds), millisecond: 0 });

  // Minutes-only: end snaps to :59.999 to stay inclusive; start stays at :00.000.
  return boundary === 'end' ? base.set({ second: 59, millisecond: 999 }) : base;
}

// Bare day (`YYYY-MM-DD`) or wall-clock datetime (`YYYY-MM-DD[T| ]HH:mm[:ss]`), interpreted as
// local time in the request timezone and returned as a UTC instant so the store can compare it
// to stored timestamps.
export function parseDateBoundary(
  raw: string | undefined,
  timezone: string,
  boundary: 'start' | 'end',
): string | undefined {
  if (!raw) return undefined;

  const instant = toLocalInstant(raw, timezone, boundary);

  if (!instant.isValid) {
    throw new ValidationError(
      instant.invalidReason === 'unsupported zone'
        ? `Invalid timezone: "${timezone}"`
        : `Invalid date: "${raw}" (expected YYYY-MM-DD, YYYY-MM-DDTHH:mm, or an ISO 8601 instant)`,
    );
  }

  return instant.toUTC().toISO() ?? undefined;
}
