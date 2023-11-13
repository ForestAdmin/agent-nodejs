function addNullValuesOnRecord(
  record: Record<string, unknown>,
  projection: string[],
): Record<string, unknown> {
  if (!record) return record;

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

  return result;
}

export default function addNullValues(
  records: Record<string, unknown>[],
  projection: string[],
): Record<string, unknown>[] {
  return records.map(record => addNullValuesOnRecord(record, projection));
}
