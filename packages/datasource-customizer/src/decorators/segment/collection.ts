import type { SegmentDefinition } from './types';
import type { Caller, CollectionSchema, PaginatedFilter } from '@forestadmin/datasource-toolkit';

import {
  BusinessError,
  CollectionDecorator,
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  ConditionTreeValidator,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

import CollectionCustomizationContext from '../../context/collection-context';

export default class SegmentCollectionDecorator extends CollectionDecorator {
  private segments: { [name: string]: SegmentDefinition } = {};

  addSegment(segmentName: string, definition: SegmentDefinition): void {
    this.segments[segmentName] = definition;
    this.markSchemaAsDirty();
  }

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return {
      ...subSchema,
      segments: [...subSchema.segments, ...Object.keys(this.segments)],
    };
  }

  public override async refineFilter(
    caller: Caller,
    filter?: PaginatedFilter,
  ): Promise<PaginatedFilter> {
    if (!filter) {
      return null;
    }

    const trees = await Promise.all([
      this.refineFilterSegment(caller, filter),
      this.refineFilterLiveQuerySegment(filter),
    ]);

    const conditionTree = ConditionTreeFactory.intersect(filter.conditionTree, ...trees);

    return filter.override({ conditionTree, segment: null, liveQuerySegment: null });
  }

  private async refineFilterSegment(caller: Caller, filter: PaginatedFilter) {
    const { segment } = filter;

    if (segment && this.segments[segment]) {
      const definition = this.segments[segment];
      const result =
        typeof definition === 'function'
          ? await definition(new CollectionCustomizationContext(this, caller))
          : await definition;

      const conditionTree =
        result instanceof ConditionTree ? result : ConditionTreeFactory.fromPlainObject(result);

      ConditionTreeValidator.validate(conditionTree, this);

      return conditionTree;
    }

    return null;
  }

  private async refineFilterLiveQuerySegment(filter: PaginatedFilter) {
    const { liveQuerySegment } = filter;

    if (liveQuerySegment) {
      const { query, connectionName, contextVariables } = liveQuerySegment;

      try {
        const result = (await this.dataSource.executeNativeQuery(
          connectionName,
          query,
          contextVariables,
        )) as Record<string, unknown>[];

        const [primaryKey] = SchemaUtils.getPrimaryKeys(this.childCollection.schema);

        const conditionTree = new ConditionTreeLeaf(
          primaryKey,
          'In',
          result.map(row => row[primaryKey]),
        );

        ConditionTreeValidator.validate(conditionTree, this);

        return conditionTree;
      } catch (error) {
        throw new BusinessError(
          `An error occurred during the execution of the segment query - ${error.message}`,
          error,
        );
      }
    }

    return null;
  }
}
