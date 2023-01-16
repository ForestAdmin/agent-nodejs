import {
  Caller,
  CollectionSchema,
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeValidator,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';

import { SegmentDefinition } from './types';
import CollectionCustomizationContext from '../../context/collection-context';
import CollectionDecorator from '../collection-decorator';

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

    let { conditionTree, segment } = filter;

    if (segment && this.segments[segment]) {
      const definition = this.segments[segment];
      const result =
        typeof definition === 'function'
          ? await definition(new CollectionCustomizationContext(this, caller))
          : await definition;

      const conditionTreeSegment =
        result instanceof ConditionTree ? result : ConditionTreeFactory.fromPlainObject(result);

      ConditionTreeValidator.validate(conditionTreeSegment, this);

      conditionTree = ConditionTreeFactory.intersect(conditionTree, conditionTreeSegment);
      segment = null;
    }

    return filter.override({ conditionTree, segment });
  }
}
