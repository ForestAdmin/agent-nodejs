type AuditEntry = {
  operation: 'create' | 'update' | 'delete';
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

// Plain object on both sides ⇒ nested diff; otherwise `previous` is the leaf to write back.
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

// `entries` must arrive newest-first. Walking stops on the first terminal event: `create` ⇒ `null`
// (record did not exist yet), `delete` ⇒ its `previousValues` snapshot (older entries are ignored).
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
