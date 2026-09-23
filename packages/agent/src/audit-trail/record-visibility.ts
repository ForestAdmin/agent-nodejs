import type { Collection, ConditionTree } from '@forestadmin/datasource-toolkit';
import type { Context } from 'koa';

import {
  ConditionTreeFactory,
  PaginatedFilter,
  Projection,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

import IdUtils from '../utils/id';
import QueryStringParser from '../utils/query-string';

export async function recordExists(
  collection: Collection,
  packedId: string,
  context: Context,
  permissionScope: ConditionTree | null,
): Promise<boolean> {
  const id = IdUtils.unpackId(collection.schema, packedId);
  const filter = new PaginatedFilter({
    conditionTree: ConditionTreeFactory.intersect(
      ConditionTreeFactory.matchIds(collection.schema, [id]),
      permissionScope,
    ),
  });

  const records = await collection.list(
    QueryStringParser.parseCaller(context, { defaultTimezone: 'UTC' }),
    filter,
    new Projection(...SchemaUtils.getPrimaryKeys(collection.schema)),
  );

  return records.length > 0;
}

export type RecordVisibility = {
  /** False → the id still exists and fails the permission scope; the caller must be denied entirely (404). */
  visible: boolean;
  /**
   * True once the id no longer exists at all, under any scope. `visible` is then true for a
   * different reason than "the record matches the scope": there is nothing left to check
   * existence against. It doesn't mean every value the audit trail holds for that record is safe
   * to hand back to this caller — a scoped-down field value captured while the record still
   * existed can still fall outside the caller's permission scope, and callers should check that separately
   * (e.g. by re-evaluating the permission scope's `ConditionTree` against a delete row's `previousValues`)
   * before deciding how much of the record's captured data to surface.
   */
  goneEntirely: boolean;
};

// A record-level permission scope can't be evaluated against a record that no longer exists, so a caller whose
// access is scoped down is only denied when the id currently exists and fails that permission scope — once it's
// genuinely gone there is nothing left to scope against, and showing that it existed (including that
// it was deleted, by whom and when) is much of the point of an audit trail.
// The caller passes the permission scope it will also withhold with, rather than this reading its
// own: two lookups can disagree if the scope cache turns over between them, and the answer here
// decides what that scope is then applied to.
export default async function checkRecordVisibility(
  collection: Collection,
  packedId: string,
  context: Context,
  permissionScope: ConditionTree | null,
): Promise<RecordVisibility> {
  if (!permissionScope) return { visible: true, goneEntirely: false };

  if (await recordExists(collection, packedId, context, permissionScope)) {
    return { visible: true, goneEntirely: false };
  }

  const existsOutsidePermissionScope = await recordExists(collection, packedId, context, null);

  return { visible: !existsOutsidePermissionScope, goneEntirely: !existsOutsidePermissionScope };
}

/**
 * The record can be deleted — or moved out of the caller's permission scope — between the check
 * that authorized the request and the audit read that answers it: the audit trail lives in its own
 * database, often its own engine, so no single snapshot spans both. Re-reads once the rows are in
 * hand, and returns null when there is nothing to re-read: a caller with no scope has nothing to
 * withhold, and a record already gone at the first check cannot come back.
 */
export async function recheckRecordVisibility(
  collection: Collection,
  packedId: string,
  context: Context,
  permissionScope: ConditionTree | null,
  wasGoneEntirely: boolean,
): Promise<RecordVisibility | null> {
  if (!permissionScope || wasGoneEntirely) return null;

  return checkRecordVisibility(collection, packedId, context, permissionScope);
}
