import type { AuditRecord } from './types';
import type { Context } from 'koa';

// `admin` exactly, not a privileged set (PRD-1259). The level comes from the Forest-signed JWT that
// `context.state.user` holds, so it needs no round-trip and cannot be forged by the caller.
function isAdmin(context: Context): boolean {
  return context.state.user?.permissionLevel === 'admin';
}

// Applies to the project-level timeline only. A record's own history is not gated: someone who can
// read the collection can already read the record, so its before/after values tell them nothing the
// record itself doesn't. The project-wide feed is a different exposure — every collection at once,
// no record to know in advance — and that aggregate is what stays admin-only.
//
// The row itself always stays: operation, author and timestamp are what makes the timeline readable,
// and are not the values a non-admin isn't entitled to.
export default function withholdValuesFromNonAdmin(
  entries: AuditRecord[],
  context: Context,
): AuditRecord[] {
  if (isAdmin(context)) return entries;

  return entries.map(entry => ({ ...entry, previousValues: {}, newValues: {} }));
}
