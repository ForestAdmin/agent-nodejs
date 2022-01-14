import { PrimitiveTypes } from '../../..';
import { Operator } from '../../../interfaces/query/selection';
import { Alternative } from '../types';

type PatternOperators =
  | Operator.Like
  | Operator.Contains
  | Operator.StartsWith
  | Operator.EndsWith
  | Operator.NotContains
  | Operator.LongerThan
  | Operator.ShorterThan;

const alternatives: Record<PatternOperators, Alternative[]> = {
  [Operator.Like]: [],
  [Operator.Contains]: [
    {
      dependsOn: [Operator.Like],
      forTypes: [PrimitiveTypes.String],
      replacer: ({ field, value }) => ({ field, operator: Operator.Like, value: `%${value}%` }),
    },
  ],
  [Operator.StartsWith]: [
    {
      dependsOn: [Operator.Like],
      forTypes: [PrimitiveTypes.String],
      replacer: ({ field, value }) => ({ field, operator: Operator.Like, value: `${value}%` }),
    },
  ],
  [Operator.EndsWith]: [
    {
      dependsOn: [Operator.Like],
      forTypes: [PrimitiveTypes.String],
      replacer: ({ field, value }) => ({ field, operator: Operator.Like, value: `%${value}` }),
    },
  ],
  [Operator.NotContains]: [],
  [Operator.LongerThan]: [],
  [Operator.ShorterThan]: [],
};

export default alternatives;
