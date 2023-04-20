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

function match(caseSensitive: boolean): Alternative {
  return {
    dependsOn: ['Match'],
    forTypes: ['String'],
    replacer: leaf => {
      let regexp = leaf.value as string;

      // eslint-disable-next-line no-useless-escape
      regexp = regexp.replace(/([\.\\\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:\-])/g, '\\$1');
      regexp = regexp.replace(/%/g, '.*').replace(/_/g, '.');

      return leaf.override({
        operator: 'Match',
        value: RegExp(`^${regexp}$`, caseSensitive ? 'g' : 'gi'),
      });
    },
  };
}

export default (): Partial<Record<Operator, Alternative[]>> => ({
  Contains: [likes(value => `%${value}%`, true)],
  StartsWith: [likes(value => `${value}%`, true)],
  EndsWith: [likes(value => `%${value}`, true)],
  IContains: [likes(value => `%${value}%`, false)],
  IStartsWith: [likes(value => `${value}%`, false)],
  IEndsWith: [likes(value => `%${value}`, false)],
  ILike: [match(false)],
  Like: [match(true)],
});
