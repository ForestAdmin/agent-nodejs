import { Operator } from '../../../interfaces/query/selection';
import { PrimitiveTypes } from '../../../interfaces/schema';
import { Alternative } from '../types';

type PatternOperators =
  | Operator.Like
  | Operator.Contains
  | Operator.StartsWith
  | Operator.EndsWith
  | Operator.NotContains
  | Operator.LongerThan
  | Operator.ShorterThan;

function likes(getPattern: (string) => string): Alternative {
  return {
    dependsOn: [Operator.Like],
    forTypes: [PrimitiveTypes.String],
    replacer: ({ field, value }) => ({
      field,
      operator: Operator.Like,
      value: getPattern(value),
    }),
  };
}

const alternatives: Record<PatternOperators, Alternative[]> = {
  [Operator.Like]: [],
  [Operator.Contains]: [likes(value => `%${value}%`)],
  [Operator.StartsWith]: [likes(value => `${value}%`)],
  [Operator.EndsWith]: [likes(value => `%${value}`)],
  [Operator.NotContains]: [],
  [Operator.LongerThan]: [],
  [Operator.ShorterThan]: [],
};

export default alternatives;
