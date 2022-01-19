import { Aggregator, Operator } from '../../../interfaces/query/selection';
import { PrimitiveTypes } from '../../../interfaces/schema';
import ConditionTreeUtils from '../../../utils/condition-tree';
import { Alternative } from '../types';

const alternatives: Partial<Record<Operator, Alternative[]>> = {
  [Operator.Blank]: [
    {
      dependsOn: [Operator.In],
      forTypes: [PrimitiveTypes.String],
      replacer: ({ field }) => ({ field, operator: Operator.In, value: [null, ''] }),
    },
    {
      dependsOn: [Operator.Equal],
      replacer: ({ field }) => ({ field, operator: Operator.Equal, value: null }),
    },
  ],
  [Operator.Present]: [
    {
      dependsOn: [Operator.NotIn],
      forTypes: [PrimitiveTypes.String],
      replacer: ({ field }) => ({ field, operator: Operator.NotIn, value: [null, ''] }),
    },
    {
      dependsOn: [Operator.NotEqual],
      replacer: ({ field }) => ({ field, operator: Operator.NotEqual, value: null }),
    },
  ],
  [Operator.Equal]: [
    {
      dependsOn: [Operator.In],
      replacer: ({ field, value }) => ({ field, operator: Operator.In, value: [value] }),
    },
  ],
  [Operator.In]: [
    {
      dependsOn: [Operator.Equal],
      replacer: ({ field, value }) => {
        const array = value as unknown[];

        return array.length === 1
          ? { field, operator: Operator.Equal, value: array[0] }
          : {
              aggregator: Aggregator.Or,
              conditions: array.map(item => ({ field, operator: Operator.Equal, value: item })),
            };
      },
    },
  ],
  [Operator.NotEqual]: [
    {
      dependsOn: [Operator.NotIn],
      replacer: ({ field, value }) => ({ field, operator: Operator.NotIn, value: [value] }),
    },
  ],
  [Operator.NotIn]: [
    {
      dependsOn: [Operator.NotEqual],
      replacer: ({ field, value }) => {
        const array = value as unknown[];

        return ConditionTreeUtils.intersect(
          ...array.map(item => ({ field, operator: Operator.NotEqual, value: item })),
        );
      },
    },
  ],
};

export default alternatives;
