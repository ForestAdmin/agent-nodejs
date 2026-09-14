import type { PrimaryKeyField } from '../read-model/read-model';

import { mappingError } from '../http/bff-local-errors';

export const PACKED_ID_SEPARATOR = '|';

// The only column type unpacked to a number, mirroring the agent's `IdUtils.unpackId`.
const NUMBER_COLUMN_TYPE = 'Number';

function toNumberIfWhole(value: string): string | number {
  const numeric = Number(value);

  return Number.isNaN(numeric) ? value : numeric;
}

/**
 * Rebuild the structured primary key of a record from its opaque packed id, mirroring the agent's
 * `IdUtils.packId`/`unpackId` (`|`-joined values, `Number` columns cast back to numbers). Returns a
 * `{ pkField: value }` map for `__forest.primaryKey`. Throws a mapping error rather than emitting a
 * malformed key when the schema lacks key metadata or the packed id shape does not match it.
 *
 * A DERIVED key is the exception: the schema published none, so its arity is a guess and the real
 * key may be composite. Splitting `tenant|42` against one guessed key would 500 every list of that
 * collection, so a derived key takes the packed id whole — typed when the declared `id` field says
 * `Number` and the id is numeric, left a string otherwise, and never a throw.
 */
export default function unpackPrimaryKey(
  packedId: string,
  primaryKeys: PrimaryKeyField[],
): Record<string, string | number> {
  if (primaryKeys.length === 0) {
    throw mappingError('Cannot build primary key: the collection exposes no key metadata');
  }

  const [first] = primaryKeys;

  if (first.derived) {
    return {
      [first.name]: first.type === NUMBER_COLUMN_TYPE ? toNumberIfWhole(packedId) : packedId,
    };
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

    if (type !== NUMBER_COLUMN_TYPE) {
      result[name] = value;

      return;
    }

    const numeric = Number(value);

    if (Number.isNaN(numeric)) {
      throw mappingError(
        `Cannot build primary key: invalid numeric value "${value}" for "${name}"`,
      );
    }

    result[name] = numeric;
  });

  return result;
}
