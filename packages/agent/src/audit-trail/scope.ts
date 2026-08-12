import type { ForestAdminHttpDriverServices } from '../services';
import type { Collection } from '@forestadmin/datasource-toolkit';
import type { Context } from 'koa';

import {
  ConditionTreeFactory,
  PaginatedFilter,
  Projection,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

import IdUtils from '../utils/id';
import QueryStringParser from '../utils/query-string';

// A record-level scope can't be checked retroactively for a now-deleted record, so a caller whose
// access is scoped down cannot browse the audit trail of an id outside their current scope (or one
// that no longer matches it) — otherwise scope could be bypassed by deleting a record.
export default async function isRecordVisible(
  services: ForestAdminHttpDriverServices,
  collection: Collection,
  packedId: string,
  context: Context,
): Promise<boolean> {
  const scope = await services.authorization.getScope(collection, context);

  if (!scope) return true;

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
