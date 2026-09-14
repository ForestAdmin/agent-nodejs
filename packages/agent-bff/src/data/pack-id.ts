import type { PrimaryKeyField } from '../read-model/read-model';

import recordKey from './record-key';
import { mappingError } from '../http/bff-local-errors';

export const PACKED_ID_SEPARATOR = '|';

// The only column type unpacked to a number, mirroring the agent's `IdUtils.unpackId`.
const NUMBER_COLUMN_TYPE = 'Number';

/**
 * The numeric form of an id, but only when it round-trips back to the exact same characters. A
 * derived key carries the agent id opaque, so a cast that loses anything defeats its whole purpose:
 * `9007199254740993` casts to `...992` and would name a different record, `Infinity` and `NaN`
 * serialize as `null`, and `1e3` or `042` come back spelled differently from what the record's `id`
 * holds. In every one of those the string is kept, which the contract already allows.
 */
function toNumberIfLossless(value: string): string | number {
  const numeric = Number(value);

  return Number.isSafeInteger(numeric) && String(numeric) === value ? numeric : value;
}

/**
 * The value a record carries for a key field, when it can stand for a packed segment. The field is
 * read under its own name first, then under the camelCase key the deserializer emits
 * (`agent-client/src/http-requester.ts`). Anything that is not a string or a finite number is
 * ignored: a record attribute can also be `null`, a boolean, a relation object written over the
 * same key, or the JSON of a Buffer, and none of those names a segment.
 *
 * A key whose response key is shared with another field is refused outright. The record then holds
 * a single value under that key and which field wrote it is not knowable here, so reading it could
 * claim the segment of a sibling key — worse than not matching at all.
 */
function comparableValue(record: Record<string, unknown>, key: PrimaryKeyField): string | null {
  if (key.ambiguousRecordKey) return null;

  const { name } = key;
  const declared = record[name];
  const value = declared === undefined || declared === null ? record[recordKey(name)] : declared;

  if (typeof value === 'string') return value;

  return typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
}

/**
 * The packed segments, reordered onto the keys they belong to.
 *
 * The pairing cannot come from the order the keys arrive in: the apimap sorts its fields
 * alphabetically (`agent/src/utils/forest-schema/generator-collection.ts`) while the agent packs in
 * declaration order (`agent/src/utils/id.ts`), and the two agree only by accident — a
 * `tenant_id`/`seq` collection packs `acme|42` and gets `"acme"` cast as `seq`, so every list of it
 * answers 500.
 *
 * The record settles it. Its attributes hold the key values, so a segment equal to one of them
 * belongs to that key whatever the published order. The record is used for THAT and nothing else —
 * the value emitted is always the packed segment, never the record's own. The case that forces it
 * is a key named `id`: `jsonapi-serializer` overwrites that attribute with the resource id
 * (`deserializer-utils.js`), so the record would hand back `acme|42` for it. Reading the segment
 * instead keeps that key correct, and it matches nothing, so it takes what its siblings left. A
 * `Date` or a Buffer key is the same story from the other side: their attribute form differs from
 * the packed one (ISO versus `String(date)`), they match nothing, and they keep their position.
 *
 * A key that matches nothing keeps its own positional segment whenever no match claimed it, and
 * moves only when a match did. A single unread key can be placed safely, since the one segment left
 * over is necessarily its own. Several cannot: as soon as one of them loses its segment to a match,
 * which of the remaining segments is whose is exactly the question the record failed to answer, and
 * placing them anyway hands back a wrong key under a 200 where the positional pairing would have
 * raised its numeric-cast error. The whole reordering is dropped there, errors included.
 *
 * With no record, the values are returned whole and the pairing is the positional one.
 */
function segmentsByKey(
  values: string[],
  primaryKeys: PrimaryKeyField[],
  record?: Record<string, unknown>,
): string[] {
  if (!record) return values;

  const claimed = values.map(() => false);
  const matched = primaryKeys.map(key => {
    const wanted = comparableValue(record, key);
    const index = wanted === null ? -1 : values.findIndex((v, i) => !claimed[i] && v === wanted);

    if (index === -1) return null;
    claimed[index] = true;

    return values[index];
  });

  const unread = matched.filter(value => value === null).length;
  const placed = matched.map((value, index) => {
    if (value !== null || claimed[index]) return value;
    claimed[index] = true;

    return values[index];
  });

  if (unread > 1 && placed.some(value => value === null)) return values;

  const leftovers = values.filter((_, index) => !claimed[index]);

  return placed.map(value => value ?? (leftovers.shift() as string));
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
  record?: Record<string, unknown>,
): Record<string, string | number> {
  if (primaryKeys.length === 0) {
    throw mappingError('Cannot build primary key: the collection exposes no key metadata');
  }

  const [first] = primaryKeys;

  if (first.derived) {
    return {
      [first.name]: first.type === NUMBER_COLUMN_TYPE ? toNumberIfLossless(packedId) : packedId,
    };
  }

  const values = packedId.split(PACKED_ID_SEPARATOR);

  if (values.length !== primaryKeys.length) {
    throw mappingError(
      `Cannot build primary key: expected ${primaryKeys.length} values, found ${values.length}`,
    );
  }

  const segments = segmentsByKey(values, primaryKeys, record);
  const result: Record<string, string | number> = {};

  primaryKeys.forEach(({ name, type }, index) => {
    const value = segments[index];

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
