import { Alternative } from '../equivalence';
import { Operator } from '../nodes/operators';

function likes(getPattern: (pattern: string) => string): Alternative {
  return {
    dependsOn: ['Like'],
    forTypes: ['String'],
    replacer: leaf => leaf.override({ operator: 'Like', value: getPattern(leaf.value as string) }),
  };
}

export default (): Partial<Record<Operator, Alternative[]>> => ({
  Contains: [likes(value => `%${value}%`)],
  StartsWith: [likes(value => `${value}%`)],
  EndsWith: [likes(value => `%${value}`)],
});
