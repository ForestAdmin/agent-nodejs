import { CollectionSchema } from '../../interfaces/schema';
import { QueryRecipient } from '../../interfaces/user';
import { SegmentDefinition } from './types';
import CollectionCustomizationContext from '../../context/collection-context';
import CollectionDecorator from '../collection-decorator';
import ConditionTree from '../../interfaces/query/condition-tree/nodes/base';
import ConditionTreeFactory from '../../interfaces/query/condition-tree/factory';
import ConditionTreeValidator from '../../validation/condition-tree';
import PaginatedFilter from '../../interfaces/query/filter/paginated';

export default class SegmentCollectionDecorator extends CollectionDecorator {
  private segments: { [name: string]: SegmentDefinition } = {};

  addSegment(segmentName: string, definition: SegmentDefinition): void {
    this.segments[segmentName] = definition;
    this.markSchemaAsDirty();
  }

  protected refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return {
      ...subSchema,
      segments: [...subSchema.segments, ...Object.keys(this.segments)],
    };
  }

  public override async refineFilter(
    recipient: QueryRecipient,
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
          ? await definition(new CollectionCustomizationContext(this, recipient))
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
