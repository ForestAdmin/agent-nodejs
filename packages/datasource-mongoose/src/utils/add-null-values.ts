import { FOREST_RECORD_DOES_NOT_EXIST } from './pipeline/condition-generator';

/**
 * Filter out records that have been tagged as not existing
 * If the key FOREST_RECORD_DOES_NOT_EXIST is present in the record, the record is removed
 * If a nested object has a key with FOREST_RECORD_DOES_NOT_EXIST, the nested object is removed
 */
function removeNotExistRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  if (!record || record[FOREST_RECORD_DOES_NOT_EXIST]) return null;

  Object.entries(record).forEach(([key, value]) => {
    if (
      value &&
      typeof value === 'object' &&
      Object.values(value).find(v => v === FOREST_RECORD_DOES_NOT_EXIST)
    ) {
      record[key] = null;
    }
  });

  return record;
}

function addNullValuesOnRecord(
  record: Record<string, unknown>,
  projection: string[],
): Record<string, unknown> {
  if (!record) return null;

  const result = { ...record };

  for (const field of projection) {
    const fieldPrefix = field.split(':')[0];

    if (result[fieldPrefix] === undefined) {
      result[fieldPrefix] = null;
    }
  }

  const nestedPrefixes = new Set(
    projection.filter(field => field.includes(':')).map(field => field.split(':')[0]),
  );

  for (const nestedPrefix of nestedPrefixes) {
    const childPaths = projection
      .filter(field => field.startsWith(`${nestedPrefix}:`))
      .map(field => field.substring(nestedPrefix.length + 1));

    if (result[nestedPrefix] !== null && result[nestedPrefix] !== undefined) {
      if (Array.isArray(result[nestedPrefix])) {
        result[nestedPrefix] = (result[nestedPrefix] as Record<string, unknown>[]).map(
          childRecord => addNullValuesOnRecord(childRecord, childPaths),
        );
      } else if (typeof result[nestedPrefix] === 'object') {
        result[nestedPrefix] = addNullValuesOnRecord(
          result[nestedPrefix] as Record<string, unknown>,
          childPaths,
        );
      }
    }
  }

  return removeNotExistRecord(result);
}

export default function addNullValues(
  records: Record<string, unknown>[],
  projection: string[],
): Record<string, unknown>[] {
  return records.map(record => addNullValuesOnRecord(record, projection)).filter(Boolean);
}
