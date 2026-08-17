type AuditEntry = {
  operation: 'create' | 'update' | 'delete';
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

// Plain object on both sides ⇒ nested diff, walking the union of both sides' keys so an added key
// (present only in `next`) is caught too, not just a removed one. Anything else — including a key
// present in `next` but not `previous` at this exact level — is a leaf: `previous` is the value to
// write back as-is (this also covers "the whole field was replaced with something else", where
// `previous`/`next` at this level aren't a matching object pair at all).
const revertValue = (current: unknown, previous: unknown, next: unknown): unknown => {
  if (!isPlainObject(previous) || !isPlainObject(next)) return previous;

  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);

  if (Array.isArray(current)) {
    const result = [...current];
    const removedIndices: number[] = [];

    for (const key of keys) {
      if (!(key in previous)) {
        // Present only in `next`: this index was appended by the change, remove it on revert.
        removedIndices.push(Number(key));
      } else {
        result[Number(key)] = revertValue(result[Number(key)], previous[key], next[key]);
      }
    }

    // Highest index first so removing one doesn't shift the position of the next one to remove.
    removedIndices
      .sort((a, b) => b - a)
      .forEach(index => {
        result.splice(index, 1);
      });

    return result;
  }

  const base = isPlainObject(current) ? current : {};
  const result: Record<string, unknown> = { ...base };

  for (const key of keys) {
    if (!(key in previous)) {
      // Present only in `next`: this key was added by the change, remove it on revert.
      delete result[key];
    } else {
      result[key] = revertValue(result[key], previous[key], next[key]);
    }
  }

  return result;
};

const revertOne = (
  current: Record<string, unknown>,
  entry: AuditEntry,
): Record<string, unknown> => {
  const result = { ...current };
  const columns = new Set([...Object.keys(entry.previousValues), ...Object.keys(entry.newValues)]);

  for (const column of columns) {
    if (!(column in entry.previousValues)) {
      // The change added this column (e.g. a smart action wrote a new field for the first time);
      // reverting removes it rather than writing back a bogus `null`.
      delete result[column];
    } else {
      result[column] = revertValue(
        result[column],
        entry.previousValues[column],
        entry.newValues[column],
      );
    }
  }

  return result;
};

// `entries` must arrive newest-first. `create`/`delete` restore their terminal snapshot (`null` /
// `previousValues`) and walking continues into older entries, so a target timestamp that predates
// a delete-then-recreate (or update-then-delete) cycle still resolves to the earlier incarnation
// instead of stopping dead on the first terminal event encountered.
export default function revertRecord(
  current: Record<string, unknown> | null,
  entries: AuditEntry[],
): Record<string, unknown> | null {
  let state = current;

  for (const entry of entries) {
    if (entry.operation === 'create') {
      state = null;
    } else if (entry.operation === 'delete') {
      state = { ...entry.previousValues };
    } else if (state) {
      state = revertOne(state, entry);
    }
  }

  return state;
}
