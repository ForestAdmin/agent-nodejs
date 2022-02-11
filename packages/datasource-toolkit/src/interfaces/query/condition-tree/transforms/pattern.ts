import { Alternative } from '../equivalence';
import { Operator } from '../nodes/leaf';
import { PrimitiveTypes } from '../../../schema';

function likes(getPattern: (pattern: string) => string): Alternative {
  return {
    dependsOn: [Operator.Like],
    forTypes: [PrimitiveTypes.String],
    replacer: leaf =>
      leaf.override({ operator: Operator.Like, value: getPattern(leaf.value as string) }),
  };
}

export default (): Partial<Record<Operator, Alternative[]>> => ({
  [Operator.Contains]: [likes(value => `%${value}%`)],
  [Operator.StartsWith]: [likes(value => `${value}%`)],
  [Operator.EndsWith]: [likes(value => `%${value}`)],
});
