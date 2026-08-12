import { ABSENT } from './types';

type AuditEntry = {
  operation: 'create' | 'update' | 'delete';
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

// Plain object on both sides ⇒ nested diff; otherwise `previous` is the leaf to write back, or
// `ABSENT` to signal that the key/index did not exist before this change and must be removed.
const revertValue = (current: unknown, previous: unknown, next: unknown): unknown => {
  if (previous === ABSENT) return ABSENT;
  if (!isPlainObject(previous) || !isPlainObject(next)) return previous;

  if (Array.isArray(current)) {
    const result = [...current];
    const removedIndices: number[] = [];

    for (const key of Object.keys(previous)) {
      const index = Number(key);
      const reverted = revertValue(result[index], previous[key], next[key]);

      if (reverted === ABSENT) {
        removedIndices.push(index);
      } else {
        result[index] = reverted;
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

  for (const key of Object.keys(previous)) {
    const reverted = revertValue(result[key], previous[key], next[key]);

    if (reverted === ABSENT) {
      delete result[key];
    } else {
      result[key] = reverted;
    }
  }

  return result;
};

const revertOne = (
  current: Record<string, unknown>,
  entry: AuditEntry,
): Record<string, unknown> => {
  const result = { ...current };

  for (const column of Object.keys(entry.previousValues)) {
    const reverted = revertValue(
      result[column],
      entry.previousValues[column],
      entry.newValues[column],
    );

    if (reverted === ABSENT) {
      delete result[column];
    } else {
      result[column] = reverted;
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
