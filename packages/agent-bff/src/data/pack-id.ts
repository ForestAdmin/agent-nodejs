import type { PrimaryKeyField } from '../read-model/read-model';

import { mappingError } from '../http/bff-local-errors';

const PACKED_ID_SEPARATOR = '|';

/**
 * Rebuild the structured primary key of a record from its opaque packed id, mirroring the agent's
 * `IdUtils.packId`/`unpackId` (`|`-joined values, `Number` columns cast back to numbers). Returns a
 * `{ pkField: value }` map for `__forest.primaryKey`. Throws a mapping error rather than emitting a
 * malformed key when the schema lacks key metadata or the packed id shape does not match it.
 */
export default function unpackPrimaryKey(
  packedId: string,
  primaryKeys: PrimaryKeyField[],
): Record<string, string | number> {
  if (primaryKeys.length === 0) {
    throw mappingError('Cannot build primary key: the collection exposes no key metadata');
  }

  const values = packedId.split(PACKED_ID_SEPARATOR);

  if (values.length !== primaryKeys.length) {
    throw mappingError(
      `Cannot build primary key: expected ${primaryKeys.length} values, found ${values.length}`,
    );
  }

  const result: Record<string, string | number> = {};

  primaryKeys.forEach(({ name, type }, index) => {
    const value = values[index];
    result[name] = type === 'Number' ? Number(value) : value;
  });

  return result;
}
