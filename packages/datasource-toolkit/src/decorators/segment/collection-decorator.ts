import CollectionDecorator from '../collection-decorator';
import { ConditionTree, Filter } from '../../interfaces/query/selection';
import { CollectionSchema } from '../../interfaces/schema';
import ConditionTreeUtils from '../../utils/condition-tree';

interface IConditionTreeGenerator {
  getConditionTree: (timezone: string) => Promise<ConditionTree>;
}

export default class SegmentCollectionDecorator extends CollectionDecorator {
  private segments: { [name: string]: IConditionTreeGenerator } = {};

  registerSegment(
    segmentName: string,
    getConditionTree: IConditionTreeGenerator['getConditionTree'],
  ): void {
    this.segments[segmentName] = { getConditionTree };
  }

  protected refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return {
      ...subSchema,
      segments: [...subSchema.segments, ...Object.keys(this.segments)],
    };
  }

  public override async refineFilter(filter?: Filter): Promise<Filter> {
    if (!filter) {
      return null;
    }

    let { conditionTree, segment } = filter;

    if (segment && this.segments[segment]) {
      const conditionTreeSegment = await this.segments[segment].getConditionTree(filter.timezone);
      ConditionTreeUtils.validate(conditionTreeSegment, this);

      conditionTree = ConditionTreeUtils.intersect(conditionTree, conditionTreeSegment);
      segment = null;
    }

    return { ...filter, conditionTree, segment };
  }
}
