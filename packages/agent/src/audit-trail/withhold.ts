import type { AuditRecord } from './types';
import type {
  Collection,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Logger,
} from '@forestadmin/datasource-toolkit';

import { SchemaUtils } from '@forestadmin/datasource-toolkit';

import { REDACTED } from './instrument';
import IdUtils from '../utils/id';

export type Withholding = {
  collection: Collection;
  permissionScope: ConditionTree;
  timezone: string;
  logger?: Logger;
};

/**
 * Whether the row's own packed id answers for the side being tested.
 *
 * `false` for the previous side of an `update`: the capture files a row under the identity the
 * record ended up with, so on an update that moved the primary key the row's id describes the new
 * state only. It is also `false` for `/state`, whose reconstruction can sit on the far side of a
 * move the route cannot see.
 */
type IdAnswersForSide = boolean;

function asksForNull({ operator, value }: ConditionTreeLeaf): boolean {
  switch (operator) {
    case 'Blank':
    case 'Missing':
      return true;
    case 'Equal':
      return value === null || value === undefined;
    case 'In':
      return Array.isArray(value) && value.some(item => item === null || item === undefined);
    default:
      return false;
  }
}

// `ConditionTree.match`, except that a null answers only a condition asking for the null itself, as
// the database tests it. In memory `status != 'private'` holds for a null status and `null < 5`
// coerces to `0 < 5`, while the scoped read that guarded the live record left that NULL out: a record
// the caller could never read alive would become readable once deleted. Stricter than a datasource
// that matches NULL there (Mongo's `$ne`), never looser.
function matchesAsStored(
  tree: ConditionTree,
  values: Record<string, unknown>,
  collection: Collection,
  timezone: string,
): boolean {
  // By shape, not `instanceof`: a scope can be built by another copy of the toolkit.
  if ('aggregator' in tree) {
    const branch = tree as ConditionTreeBranch;
    const evaluate = (condition: ConditionTree) =>
      matchesAsStored(condition, values, collection, timezone);

    return branch.aggregator === 'And'
      ? branch.conditions.every(evaluate)
      : branch.conditions.some(evaluate);
  }

  const leaf = tree as ConditionTreeLeaf;
  const value = values[leaf.field];

  return value === null || value === undefined
    ? asksForNull(leaf)
    : leaf.match(values, collection, timezone);
}

// Only a snapshot that answers every field the permission scope asks about is worth matching. The
// capture keeps the writable columns, so a permission scope reaching for anything else — a
// read-only column, a relation — reads `undefined` there and would answer for a value the row never
// held: `status != 'private'` matches on the missing key and releases it.
//
// The snapshot reaching this point has already had its unanswerable fields removed, so a missing key
// is the whole test — see `answerableSnapshot`.
//
// Own properties only: `'toString' in snapshot` is true of every object, so a permission scope on a
// column named after one of `Object.prototype`'s members would otherwise resolve against the
// prototype.
export function permissionScopeAccepts(
  snapshot: Record<string, unknown>,
  { collection, permissionScope, timezone }: Withholding,
): boolean {
  const values = snapshot ?? {};
  const answered = permissionScope.projection.every(field =>
    Object.prototype.hasOwnProperty.call(values, field),
  );

  return answered && matchesAsStored(permissionScope, values, collection, timezone);
}

/**
 * What this side of a row can honestly answer about.
 *
 * A redacted value answers nothing, so it is dropped rather than matched against the placeholder:
 * the field then reads as unanswered, which withholds.
 *
 * The packed id then fills in the primary keys the snapshot cannot supply, but only where the row's
 * id is authoritative for this side:
 *
 * - **absent** means the key is read-only — the capture keeps every writable column — and a
 *   read-only key cannot move, so the row's id answers for it on either side. Always filled.
 * - **redacted** means the key is writable, so it can have moved. The row's id then answers only for
 *   the side it was filed under. Filling the other side would judge the previous state by an id it
 *   never had, and a permission scope on the new id would release values captured under the old one.
 *
 * Declining to fill over-withholds an update's previous side whenever its primary key is redacted —
 * the same "absent is not the same as passing" direction as everything else here. Carrying the
 * id it moved from is what would remove that cost; see PRD-1321.
 */
function answerableSnapshot(
  values: Record<string, unknown>,
  decoded: Record<string, unknown> | null,
  idAnswersForSide: IdAnswersForSide,
): Record<string, unknown> {
  const entries = Object.entries(values ?? {});
  const answered = Object.fromEntries(entries.filter(([, value]) => value !== REDACTED));

  if (!decoded) return answered;

  const redacted = new Set(
    entries.filter(([, value]) => value === REDACTED).map(([field]) => field),
  );
  const fill = Object.fromEntries(
    Object.entries(decoded).filter(([field]) => idAnswersForSide || !redacted.has(field)),
  );

  return { ...fill, ...answered };
}

/**
 * The row's packed id as a `{ key: value }` map, or null when there is none to read — no id at all
 * (a pending create), or one the current schema can no longer unpack.
 *
 * Absence is `null`, not falsiness: `''` is a legal value for a string primary key, and it packs
 * and unpacks like any other. Reading it as "no id" would leave the key unanswered and blank the
 * values of a record whose id genuinely is the empty string.
 */
export function decodePrimaryKeys(
  packedId: string | null,
  collection: Collection,
  logger?: Logger,
): Record<string, unknown> | null {
  if (packedId === null || packedId === undefined) return null;

  try {
    const names = SchemaUtils.getPrimaryKeys(collection.schema);
    const ids = IdUtils.unpackId(collection.schema, packedId);

    return Object.fromEntries(names.map((name, index) => [name, ids[index]]));
  } catch (error) {
    // The id the row was filed under no longer fits the collection's key: a renamed or retyped
    // primary key, or a corrupted row. Withholding is the safe answer and the caller gets it
    // either way, but a live audit read failing to decode its own ids is worth saying out loud.
    logger?.('Warn', `Audit trail: cannot unpack record id "${packedId}" (${error.message})`);

    return null;
  }
}

/** The snapshot a permission scope should be evaluated against, for one side of one row. */
export function snapshotFor(
  values: Record<string, unknown>,
  packedId: string | null,
  { collection, logger }: Pick<Withholding, 'collection' | 'logger'>,
  idAnswersForSide: IdAnswersForSide = true,
): Record<string, unknown> {
  return answerableSnapshot(
    values,
    decodePrimaryKeys(packedId, collection, logger),
    idAnswersForSide,
  );
}

/**
 * Blanks the captured values a caller's record-level permission scope does not cover, keeping the row itself:
 * that it happened, by whom and when stays visible either way.
 *
 * Each side is tested against its own snapshot. An `update` carries a partial diff, so a permission scope on a
 * column it never touched is simply unanswerable there and withheld by the same rule as everything
 * else — which is why this needs no special case beyond `action` rows, whose two columns hold a
 * submitted form and a result summary rather than column values.
 */
export default function withholdOutsidePermissionScope(
  entries: AuditRecord[],
  withholding: Withholding,
): AuditRecord[] {
  return entries.map(entry => {
    if (entry.operation === 'action' || entry.operation === 'action_failed') return entry;

    // Decoded once per row rather than once per side: the two sides read the same id, and a row
    // whose id no longer decodes should say so once.
    const decoded = decodePrimaryKeys(entry.recordId, withholding.collection, withholding.logger);

    const side = (values: Record<string, unknown>, idAnswersForSide: IdAnswersForSide) =>
      permissionScopeAccepts(answerableSnapshot(values, decoded, idAnswersForSide), withholding)
        ? values ?? {}
        : {};

    return {
      ...entry,
      // The row is filed under the identity the record ended up with, so its id answers for the
      // new side of an update and for a create or a delete — never for what an update moved away
      // from.
      previousValues: side(entry.previousValues, entry.operation !== 'update'),
      newValues: side(entry.newValues, true),
    };
  });
}
