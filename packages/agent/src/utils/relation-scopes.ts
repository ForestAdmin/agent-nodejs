import type {
  Caller,
  Collection,
  ConditionTree,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import {
  ConditionTreeFactory,
  Filter,
  Projection,
  RecordUtils,
} from '@forestadmin/datasource-toolkit';

export type RelationScope = { path: string; collection: Collection; scope: ConditionTree };

/**
 * The scope of a collection reached through a to-one relation empties the related record rather
 * than filtering the root rows: a scope on `accounts` restricts which accounts are seen, never
 * which `cards` exist.
 *
 * Which related records are in scope is asked of the datasource, one query per scoped relation
 * and per page, so the scope is evaluated with the same semantics as everywhere else (dates,
 * nulls, timezones) rather than re-implemented in memory.
 */
export default class RelationScopes {
  constructor(private readonly scopes: RelationScope[] = []) {}

  withRelatedKeys(projection: Projection): Projection {
    return projection.union(
      ...this.scopes.map(({ path, collection }) => new Projection().withPks(collection).nest(path)),
    );
  }

  async redact(
    records: RecordData[],
    projection: Projection,
    caller: Caller,
  ): Promise<RecordData[]> {
    if (!this.scopes.length) return records;

    const outOfScope = await Promise.all(
      this.scopes.map(scope => this.getOutOfScopeRecords(records, scope, caller)),
    );
    const reprojected = projection.apply(records);

    reprojected.forEach((record, index) => {
      this.scopes.forEach(({ path }, scopeIndex) => {
        if (outOfScope[scopeIndex].has(index)) RelationScopes.clear(record, path);
      });
    });

    return reprojected;
  }

  /** Indexes of the records whose related record at `path` is outside `scope`. */
  private async getOutOfScopeRecords(
    records: RecordData[],
    { path, collection, scope }: RelationScope,
    caller: Caller,
  ): Promise<Set<number>> {
    const related = records.map(record => RecordUtils.getFieldValue(record, path) as RecordData);
    const loaded = related.filter(Boolean);
    if (!loaded.length) return new Set();

    const inScope = await collection.list(
      caller,
      new Filter({
        conditionTree: ConditionTreeFactory.intersect(
          ConditionTreeFactory.matchRecords(collection.schema, loaded),
          scope,
        ),
      }),
      new Projection().withPks(collection),
    );
    // Each key value is encoded on its own: joined with '|', ['a|b', 'c'] would equal ['a', 'b|c'].
    const keyOf = (record: RecordData) =>
      JSON.stringify(RecordUtils.getPrimaryKey(collection.schema, record).map(String));
    const inScopeIds = new Set(inScope.map(keyOf));

    return new Set(
      related
        .map((record, index) => (record && !inScopeIds.has(keyOf(record)) ? index : -1))
        .filter(index => index !== -1),
    );
  }

  private static clear(record: RecordData, path: string): void {
    const index = path.indexOf(':');

    if (index === -1) {
      record[path] = null;

      return;
    }

    const related = record[path.substring(0, index)] as RecordData;
    if (related) RelationScopes.clear(related, path.substring(index + 1));
  }
}
