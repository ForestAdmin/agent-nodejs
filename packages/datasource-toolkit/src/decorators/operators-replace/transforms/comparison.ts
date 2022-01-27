import ConditionTree from '../../../interfaces/query/condition-tree/base';
import { Operator } from '../../../interfaces/query/condition-tree/leaf';
import { PrimitiveTypes } from '../../../interfaces/schema';
import ConditionTreeUtils from '../../../utils/condition-tree';
import { Alternative } from '../types';

const alternatives: Partial<Record<Operator, Alternative[]>> = {
  [Operator.Blank]: [
    {
      dependsOn: [Operator.In],
      forTypes: [PrimitiveTypes.String],
      replacer: leaf => leaf.override({ operator: Operator.In, value: [null, ''] }),
    },
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
        ConditionTreeUtils.union(
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
        ConditionTreeUtils.intersect(
          ...(leaf.value as unknown[]).map<ConditionTree>(item =>
            leaf.override({ operator: Operator.NotEqual, value: item }),
          ),
        ),
    },
  ],
};

export default alternatives;
