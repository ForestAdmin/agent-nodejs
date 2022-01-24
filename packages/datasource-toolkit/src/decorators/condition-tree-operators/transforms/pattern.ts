import { Operator } from '../../../interfaces/query/selection';
import { PrimitiveTypes } from '../../../interfaces/schema';
import { Alternative } from '../types';

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

const alternatives: Partial<Record<Operator, Alternative[]>> = {
  [Operator.Contains]: [likes(value => `%${value}%`)],
  [Operator.StartsWith]: [likes(value => `${value}%`)],
  [Operator.EndsWith]: [likes(value => `%${value}`)],
};

export default alternatives;
