import type {
  Collection,
  ConditionTree,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import { RecordUtils } from '@forestadmin/datasource-toolkit';

export type RelationScope = { path: string; collection: Collection; scope: ConditionTree };

/**
 * The scope of a collection reached through a to-one relation empties the related record rather
 * than filtering the root rows: a scope on `accounts` restricts which accounts are seen, never
 * which `cards` exist.
 */
export default class RelationScopes {
  constructor(private readonly scopes: RelationScope[] = []) {}

  withScopeFields(projection: Projection): Projection {
    return projection.union(...this.scopes.map(({ path, scope }) => scope.projection.nest(path)));
  }

  redact(records: RecordData[], projection: Projection, timezone: string): RecordData[] {
    if (!this.scopes.length) return records;

    const outOfScopePaths = records.map(record => this.getOutOfScopePaths(record, timezone));
    const reprojected = projection.apply(records);

    reprojected.forEach((record, index) => {
      for (const path of outOfScopePaths[index]) RelationScopes.clear(record, path);
    });

    return reprojected;
  }

  private getOutOfScopePaths(record: RecordData, timezone: string): string[] {
    return this.scopes
      .filter(({ path, collection, scope }) => {
        const related = RecordUtils.getFieldValue(record, path) as RecordData;

        return related && !scope.match(related, collection, timezone);
      })
      .map(({ path }) => path);
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
