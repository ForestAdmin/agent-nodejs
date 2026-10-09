import type { AuditRecord, AuditStore } from './types';

// A delete frees the id, and a later record can take it. A live record under the caller's scope says
// nothing about the rows filed under that id before its last delete: they are another record's, and
// its values go through the same withholding as a record gone for good.

/** The id's latest confirmed `delete`, or null when the id has never been freed. */
export async function lastDeleteOf(
  store: AuditStore,
  collection: string,
  recordId: string,
): Promise<AuditRecord | null> {
  const deletes = await store.listByRecord({
    collection,
    recordId,
    operations: ['delete'],
    order: 'desc',
  });

  // A pending delete may never have landed, so it frees nothing. Filtered here too, not just in
  // the query: a store that ignores `operations` must not turn any row into the boundary.
  return deletes.find(row => row.operation === 'delete' && row.status !== 'pending') ?? null;
}

/** Whether a row was filed at or before the boundary delete, in the trail's (timestamp, id) order. */
export function belongsToEarlierLife(row: AuditRecord, lastDelete: AuditRecord | null): boolean {
  if (!lastDelete) return false;

  return (
    row.timestamp < lastDelete.timestamp ||
    (row.timestamp === lastDelete.timestamp && row.id <= lastDelete.id)
  );
}
