import type { Alternative } from '../equivalence';
import type { Operator } from '../nodes/operators';

function likes(getPattern: (pattern: string) => string, caseSensitive: boolean): Alternative {
  const operator = caseSensitive ? 'Like' : 'ILike';

  return {
    dependsOn: [operator],
    forTypes: ['String'],
    replacer: leaf => leaf.override({ operator, value: getPattern(leaf.value as string) }),
  };
}

function literal(getSource: (escaped: string) => string, caseSensitive: boolean): Alternative {
  return {
    dependsOn: ['Match'],
    forTypes: ['String'],
    replacer: leaf => {
      const escaped = `${leaf.value}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      return leaf.override({
        operator: 'Match',
        value: new RegExp(getSource(escaped), caseSensitive ? '' : 'i'),
      });
    },
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
  Contains: [literal(value => value, true), likes(value => `%${value}%`, true)],
  StartsWith: [literal(value => `^${value}`, true), likes(value => `${value}%`, true)],
  EndsWith: [literal(value => `${value}$`, true), likes(value => `%${value}`, true)],
  IContains: [literal(value => value, false), likes(value => `%${value}%`, false)],
  IStartsWith: [literal(value => `^${value}`, false), likes(value => `${value}%`, false)],
  IEndsWith: [literal(value => `${value}$`, false), likes(value => `%${value}`, false)],
  ILike: [match(false)],
  Like: [match(true)],
});
