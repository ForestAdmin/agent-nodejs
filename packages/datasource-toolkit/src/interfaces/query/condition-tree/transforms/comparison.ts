import { PrimitiveTypes } from '../../../schema';
import { Alternative } from '../equivalence';
import ConditionTreeFactory from '../factory';
import ConditionTree from '../nodes/base';
import { Operator } from '../nodes/leaf';

export default (): Partial<Record<Operator, Alternative[]>> => ({
  [Operator.Blank]: [
    {
      dependsOn: [Operator.In],
      forTypes: [PrimitiveTypes.String],
      replacer: leaf => leaf.override({ operator: Operator.In, value: [null, ''] }),
    },
    {
      dependsOn: [Operator.Missing],
      replacer: leaf => leaf.override({ operator: Operator.Missing }),
    },
  ],
  [Operator.Missing]: [
    {
      dependsOn: [Operator.Equal],
      replacer: leaf => leaf.override({ operator: Operator.Equal, value: null }),
    },
  ],
  [Operator.Present]: [
    {
      dependsOn: [Operator.NotIn],
      forTypes: [PrimitiveTypes.String],
      replacer: leaf => leaf.override({ operator: Operator.NotIn, value: [null, ''] }),
    },
    {
      dependsOn: [Operator.NotEqual],
      replacer: leaf => leaf.override({ operator: Operator.NotEqual, value: null }),
    },
  ],
  [Operator.Equal]: [
    {
      dependsOn: [Operator.In],
      replacer: leaf => leaf.override({ operator: Operator.In, value: [leaf.value] }),
    },
  ],
  [Operator.In]: [
    {
      dependsOn: [Operator.Equal],
      replacer: leaf =>
        ConditionTreeFactory.union(
          ...(leaf.value as unknown[]).map<ConditionTree>(item =>
            leaf.override({ operator: Operator.Equal, value: item }),
          ),
        ),
    },
  ],
  [Operator.NotEqual]: [
    {
      dependsOn: [Operator.NotIn],
      replacer: leaf => leaf.override({ operator: Operator.NotIn, value: [leaf.value] }),
    },
  ],
  [Operator.NotIn]: [
    {
      dependsOn: [Operator.NotEqual],
      replacer: leaf =>
        ConditionTreeFactory.intersect(
          ...(leaf.value as unknown[]).map<ConditionTree>(item =>
            leaf.override({ operator: Operator.NotEqual, value: item }),
          ),
        ),
    },
  ],
});
