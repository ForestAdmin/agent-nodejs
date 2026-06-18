// Small helpers shared by the Smart Action customizations.

/** A Forest filter matching a single record by primary key. */
export function byId(id: string | number) {
  return { conditionTree: { field: 'id', operator: 'Equal' as const, value: id } };
}

/** A Forest filter matching several records by primary key. */
export function byIds(ids: Array<string | number>) {
  return { conditionTree: { field: 'id', operator: 'In' as const, value: ids } };
}

/** Current instant as an ISO timestamp (the demo's stand-in for SQL `NOW()`). */
export function now(): string {
  return new Date().toISOString();
}

/** Statuses for which a chargeback is considered resolved and immutable. */
export const RESOLVED_CHARGEBACK_STATUSES = ['WON', 'LOST', 'ACCEPTED', 'DISMISSED'];
