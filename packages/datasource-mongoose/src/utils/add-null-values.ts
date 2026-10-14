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

type NullValuesTree = { prefixes: string[]; children: [string, NullValuesTree][] };

function compileTree(projection: string[]): NullValuesTree {
  const prefixes = new Set<string>();
  const childPaths = new Map<string, string[]>();

  for (const field of projection) {
    const index = field.indexOf(':');
    const prefix = index === -1 ? field : field.substring(0, index);

    prefixes.add(prefix);

    if (index !== -1) {
      if (!childPaths.has(prefix)) childPaths.set(prefix, []);
      childPaths.get(prefix).push(field.substring(index + 1));
    }
  }

  return {
    prefixes: [...prefixes],
    children: [...childPaths].map(([prefix, paths]) => [prefix, compileTree(paths)]),
  };
}

function addNullValuesOnRecord(
  record: Record<string, unknown>,
  tree: NullValuesTree,
): Record<string, unknown> {
  if (!record) return null;

  const result = { ...record };

  for (const prefix of tree.prefixes) {
    if (result[prefix] === undefined) {
      result[prefix] = null;
    }
  }

  for (const [nestedPrefix, childTree] of tree.children) {
    if (result[nestedPrefix] !== null && result[nestedPrefix] !== undefined) {
      if (Array.isArray(result[nestedPrefix])) {
        result[nestedPrefix] = (result[nestedPrefix] as Record<string, unknown>[]).map(
          childRecord => addNullValuesOnRecord(childRecord, childTree),
        );
      } else if (typeof result[nestedPrefix] === 'object') {
        result[nestedPrefix] = addNullValuesOnRecord(
          result[nestedPrefix] as Record<string, unknown>,
          childTree,
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
  const tree = compileTree(projection);

  return records.map(record => addNullValuesOnRecord(record, tree)).filter(Boolean);
}
