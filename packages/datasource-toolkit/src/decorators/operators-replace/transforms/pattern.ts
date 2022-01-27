import { Operator } from '../../../interfaces/query/condition-tree/leaf';
import { PrimitiveTypes } from '../../../interfaces/schema';
import { Alternative } from '../types';

function likes(getPattern: (pattern: string) => string): Alternative {
  return {
    dependsOn: [Operator.Like],
    forTypes: [PrimitiveTypes.String],
    replacer: leaf =>
      leaf.override({ operator: Operator.Like, value: getPattern(leaf.value as string) }),
  };
}

const alternatives: Partial<Record<Operator, Alternative[]>> = {
  [Operator.Contains]: [likes(value => `%${value}%`)],
  [Operator.StartsWith]: [likes(value => `${value}%`)],
  [Operator.EndsWith]: [likes(value => `%${value}`)],
};

export default alternatives;
