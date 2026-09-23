import type { AuditRecord } from './types';
import type { Collection, ConditionTree } from '@forestadmin/datasource-toolkit';

import { SchemaUtils } from '@forestadmin/datasource-toolkit';

import { REDACTED } from './instrument';
import IdUtils from '../utils/id';

export type Withholding = {
  collection: Collection;
  permissionScope: ConditionTree;
  timezone: string;
};

// Only a snapshot that answers every field the permission scope asks about, with what was really stored, is
// worth matching. The capture keeps the writable columns, so a permission scope reaching for anything else —
// a read-only column, a relation — reads `undefined` there and would answer for a value the row
// never held: `status != 'private'` matches on the missing key and releases it. A redacted value
// answers no better: the placeholder is not what was stored.
//
// Own properties only: `'toString' in snapshot` is true of every object, so a permission scope on a column
// named after one of `Object.prototype`'s members would otherwise resolve against the prototype.
export function permissionScopeAccepts(
  snapshot: Record<string, unknown>,
  { collection, permissionScope, timezone }: Withholding,
): boolean {
  const values = snapshot ?? {};
  const answered = permissionScope.projection.every(
    field => Object.prototype.hasOwnProperty.call(values, field) && values[field] !== REDACTED,
  );

  return answered && permissionScope.match(values, collection, timezone);
}

// A read-only primary key never lands in the snapshot, so a permission scope on the id would blank a row that
// is squarely in scope. The row's own packed id carries those values — and an id the current schema
// can no longer unpack simply leaves them out, which withholds.
//
// The decoded keys win over the snapshot's own copy of them: it is the same value, except when the
// primary key is writable and redacted, where the snapshot holds the placeholder while the packed
// id — which is never redacted — still names the record the row belongs to.
function withPrimaryKeys(
  entry: AuditRecord,
  values: Record<string, unknown>,
  collection: Collection,
): Record<string, unknown> {
  const snapshot = values ?? {};

  if (!entry.recordId) return snapshot;

  try {
    const names = SchemaUtils.getPrimaryKeys(collection.schema);
    const ids = IdUtils.unpackId(collection.schema, entry.recordId);

    return { ...snapshot, ...Object.fromEntries(names.map((name, index) => [name, ids[index]])) };
  } catch {
    return snapshot;
  }
}

/**
 * Blanks the captured values a caller's record-level permission scope does not cover, keeping the row itself:
 * that it happened, by whom and when stays visible either way.
 *
 * Each side is tested against its own snapshot. An `update` carries a partial diff, so a permission scope on a
 * column it never touched is simply unanswerable there and withheld by the same rule as everything
 * else — which is why this needs no special case beyond `action` rows, whose two columns hold a
 * submitted form and a result summary rather than column values.
 */
export default function withholdOutsidePermissionScope(
  entries: AuditRecord[],
  withholding: Withholding,
): AuditRecord[] {
  const accepts = (entry: AuditRecord, values: Record<string, unknown>) =>
    permissionScopeAccepts(withPrimaryKeys(entry, values, withholding.collection), withholding);

  const side = (entry: AuditRecord, values: Record<string, unknown>) =>
    accepts(entry, values) ? values ?? {} : {};

  return entries.map(entry => {
    if (entry.operation === 'action' || entry.operation === 'action_failed') return entry;

    return {
      ...entry,
      previousValues: side(entry, entry.previousValues),
      newValues: side(entry, entry.newValues),
    };
  });
}
