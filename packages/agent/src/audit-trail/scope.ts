import type { ForestAdminHttpDriverServices } from '../services';
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
  scope: ConditionTree | null,
): Promise<boolean> {
  const id = IdUtils.unpackId(collection.schema, packedId);
  const filter = new PaginatedFilter({
    conditionTree: ConditionTreeFactory.intersect(
      ConditionTreeFactory.matchIds(collection.schema, [id]),
      scope,
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
  /** False → the id still exists and fails the scope; the caller must be denied entirely (404). */
  visible: boolean;
  /**
   * True once the id no longer exists at all, under any scope. `visible` is then true for a
   * different reason than "the record matches the scope": there is nothing left to check
   * existence against. It doesn't mean every value the audit trail holds for that record is safe
   * to hand back to this caller — a scoped-down field value captured while the record still
   * existed can still fall outside the caller's scope, and callers should check that separately
   * (e.g. by re-evaluating the scope's `ConditionTree` against a delete row's `previousValues`)
   * before deciding how much of the record's captured data to surface.
   */
  goneEntirely: boolean;
};

// A record-level scope can't be evaluated against a record that no longer exists, so a caller whose
// access is scoped down is only denied when the id currently exists and fails that scope — once it's
// genuinely gone there is nothing left to scope against, and showing that it existed (including that
// it was deleted, by whom and when) is much of the point of an audit trail.
export default async function checkRecordVisibility(
  services: ForestAdminHttpDriverServices,
  collection: Collection,
  packedId: string,
  context: Context,
): Promise<RecordVisibility> {
  const scope = await services.authorization.getScope(collection, context);

  if (!scope) return { visible: true, goneEntirely: false };

  if (await recordExists(collection, packedId, context, scope)) {
    return { visible: true, goneEntirely: false };
  }

  const existsOutsideScope = await recordExists(collection, packedId, context, null);

  return { visible: !existsOutsideScope, goneEntirely: !existsOutsideScope };
}
