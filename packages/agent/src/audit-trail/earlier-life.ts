import type { AuditRecord, AuditStore } from './types';

// A delete frees the id, and a later record can take it. A live record under the caller's scope says
// nothing about the rows filed under that id before it took the id: they are another record's, and
// its values go through the same withholding as a record gone for good.
//
// A confirmed `create` marks the boundary too: a primary-key move or an unconfirmed delete frees an
// id without leaving a confirmed `delete`, and the record that takes it next starts with its create.

/** The id's latest confirmed `delete` or `create`, or null when no record life ever ended or began. */
export async function lifeBoundaryOf(
  store: AuditStore,
  collection: string,
  recordId: string,
): Promise<AuditRecord | null> {
  const boundaries = await store.listByRecord({
    collection,
    recordId,
    operations: ['delete', 'create'],
    order: 'desc',
  });

  // A pending row may never have landed, so it marks nothing. Filtered here too, not just in the
  // query: a store that ignores `operations` must not turn any row into the boundary.
  return (
    boundaries.find(
      row => (row.operation === 'delete' || row.operation === 'create') && row.status !== 'pending',
    ) ?? null
  );
}

/**
 * Whether a row belongs to a record that held the id before the boundary, in the trail's
 * (timestamp, id) order. A boundary `delete` is the earlier record's last row, a boundary `create`
 * the current record's first.
 */
export function belongsToEarlierLife(row: AuditRecord, boundary: AuditRecord | null): boolean {
  if (!boundary) return false;
  if (row.id === boundary.id) return boundary.operation === 'delete';

  return (
    row.timestamp < boundary.timestamp ||
    (row.timestamp === boundary.timestamp && row.id < boundary.id)
  );
}

/** The rows as served: all withheld for a gone record, only the earlier lives' for a live one. */
export function withholdEarlierLives(
  rows: AuditRecord[],
  {
    gone,
    boundary,
    withhold,
  }: {
    gone: boolean;
    boundary: AuditRecord | null;
    withhold: (rows: AuditRecord[]) => AuditRecord[];
  },
): AuditRecord[] {
  if (gone) return withhold(rows);
  if (!boundary) return rows;

  const withheld = withhold(rows);

  return rows.map((row, index) => (belongsToEarlierLife(row, boundary) ? withheld[index] : row));
}
