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

// A record-level scope can't be evaluated against a record that no longer exists, so a caller whose
// access is scoped down is only denied when the id currently exists and fails that scope — once it's
// genuinely gone there is nothing left to scope against, and showing what it was (including its
// delete snapshot) is much of the point of an audit trail. Anyone who can read the collection at all
// can therefore see the history of a deleted record, scope aside; only a still-existing, out-of-scope
// record is refused.
export default async function isRecordVisible(
  services: ForestAdminHttpDriverServices,
  collection: Collection,
  packedId: string,
  context: Context,
): Promise<boolean> {
  const scope = await services.authorization.getScope(collection, context);

  if (!scope) return true;
  if (await recordExists(collection, packedId, context, scope)) return true;

  return !(await recordExists(collection, packedId, context, null));
}
