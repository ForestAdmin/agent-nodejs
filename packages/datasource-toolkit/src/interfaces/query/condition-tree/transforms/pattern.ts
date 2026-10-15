import type { Alternative } from '../equivalence';
import type { Operator } from '../nodes/operators';

import escapeRegExp from '../../../../utils/escape-regexp';

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
      return leaf.override({
        operator: 'Match',
        value: new RegExp(getSource(escapeRegExp(leaf.value)), caseSensitive ? '' : 'i'),
      });
    },
  };
}

function match(caseSensitive: boolean): Alternative {
  return {
    dependsOn: ['Match'],
    forTypes: ['String'],
    replacer: leaf => {
      const regexp = escapeRegExp(leaf.value).replace(/%/g, '.*').replace(/_/g, '.');

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
