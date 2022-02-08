import ConditionTree from '../../interfaces/query/condition-tree/base';
import PaginatedFilter from '../../interfaces/query/filter/paginated';
import { CollectionSchema } from '../../interfaces/schema';
import ConditionTreeFactory from '../../interfaces/query/condition-tree/factory';
import ConditionTreeValidator from '../../validation/condition-tree';
import CollectionDecorator from '../collection-decorator';

type ConditionTreeGenerator = (timezone: string) => Promise<ConditionTree>;

export default class SegmentCollectionDecorator extends CollectionDecorator {
  private segments: { [name: string]: ConditionTreeGenerator } = {};

  registerSegment(segmentName: string, getConditionTree: ConditionTreeGenerator): void {
    this.segments[segmentName] = getConditionTree;
  }

  protected refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return {
      ...subSchema,
      segments: [...subSchema.segments, ...Object.keys(this.segments)],
    };
  }

  public override async refineFilter(filter?: PaginatedFilter): Promise<PaginatedFilter> {
    if (!filter) {
      return null;
    }

    let { conditionTree, segment } = filter;

    if (segment && this.segments[segment]) {
      const conditionTreeSegment = await this.segments[segment](filter.timezone);
      ConditionTreeValidator.validate(conditionTreeSegment, this);

      conditionTree = ConditionTreeFactory.intersect(conditionTree, conditionTreeSegment);
      segment = null;
    }

    return filter.override({ conditionTree, segment });
  }
}
