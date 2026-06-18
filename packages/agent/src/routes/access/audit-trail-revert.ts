type AuditEntry = {
  operation: 'create' | 'update' | 'delete';
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

// Audit diffs are structural: when both `previous` and `next` are plain objects, the diff is nested
// (object keys or numeric array indexes) and we recurse; otherwise the leaf has been replaced
// wholesale and `previous` is the value to write back.
const revertValue = (current: unknown, previous: unknown, next: unknown): unknown => {
  if (!isPlainObject(previous) || !isPlainObject(next)) return previous;

  if (Array.isArray(current)) {
    const result = [...current];

    for (const key of Object.keys(previous)) {
      const index = Number(key);
      result[index] = revertValue(result[index], previous[key], next[key]);
    }

    return result;
  }

  const base = isPlainObject(current) ? current : {};
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(previous)) {
    result[key] = revertValue(result[key], previous[key], next[key]);
  }

  return result;
};

const revertOne = (
  current: Record<string, unknown>,
  entry: AuditEntry,
): Record<string, unknown> => {
  const result = { ...current };

  for (const column of Object.keys(entry.previousValues)) {
    result[column] = revertValue(
      result[column],
      entry.previousValues[column],
      entry.newValues[column],
    );
  }

  return result;
};

/**
 * Reconstruct the state of a record at a target instant by replaying audit entries in reverse.
 *
 * `current` is the record as it stands today (or `null` if it does not exist anymore); `entries`
 * are the audit logs for that record with `timestamp >= target`, sorted newest-first. The walk
 * stops on the first terminal event: a `create` returns `null` (the record did not exist yet at
 * the target instant), a `delete` returns its `previousValues` snapshot and ignores anything
 * older (the snapshot already contains everything that happened before the deletion).
 */
export default function revertRecord(
  current: Record<string, unknown> | null,
  entries: AuditEntry[],
): Record<string, unknown> | null {
  let state = current;

  for (const entry of entries) {
    if (entry.operation === 'create') return null;

    if (entry.operation === 'delete') return { ...entry.previousValues };

    if (state) state = revertOne(state, entry);
  }

  return state;
}
