import type { AuditRecord } from './types';
import type { Context } from 'koa';

import { ForbiddenError } from '@forestadmin/datasource-toolkit';

// `admin` exactly, not a privileged set (PRD-1259). The level comes from the Forest-signed JWT that
// `context.state.user` holds, so it needs no round-trip and cannot be forged by the caller.
function isAdmin(context: Context): boolean {
  return context.state.user?.permissionLevel === 'admin';
}

// The row itself always stays: operation, author and timestamp are what makes the timeline readable,
// and are not the values a non-admin isn't entitled to. Composes with the scope withholding — a row
// can fail both tests.
export function withholdValuesFromNonAdmin(
  entries: AuditRecord[],
  context: Context,
): AuditRecord[] {
  if (isAdmin(context)) return entries;

  return entries.map(entry => ({ ...entry, previousValues: {}, newValues: {} }));
}

// For a route that carries nothing but values: refusing it outright says more than an empty payload.
export function assertCanReadAuditValues(context: Context): void {
  if (!isAdmin(context)) {
    throw new ForbiddenError('Only an admin can read audit-trail values');
  }
}
