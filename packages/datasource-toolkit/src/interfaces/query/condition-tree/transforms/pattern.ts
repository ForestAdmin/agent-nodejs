import { Alternative } from '../equivalence';
import { Operator } from '../nodes/operators';

function likes(getPattern: (pattern: string) => string, caseSensitive: boolean): Alternative {
  const operator = caseSensitive ? 'Like' : 'ILike';

  return {
    dependsOn: [operator],
    forTypes: ['String'],
    replacer: leaf => leaf.override({ operator, value: getPattern(leaf.value as string) }),
  };
}

export default (): Partial<Record<Operator, Alternative[]>> => ({
  Contains: [likes(value => `%${value}%`, true)],
  StartsWith: [likes(value => `${value}%`, true)],
  EndsWith: [likes(value => `%${value}`, true)],
  IContains: [likes(value => `%${value}%`, false)],
  IStartsWith: [likes(value => `${value}%`, false)],
  IEndsWith: [likes(value => `%${value}`, false)],
});
