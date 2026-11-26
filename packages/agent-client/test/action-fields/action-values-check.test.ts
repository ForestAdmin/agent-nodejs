import type HttpRequester from '../../src/http-requester';

import { findActionValueProblems } from '../../src/action-fields/action-values-check';
import Collection from '../../src/domains/collection';

async function formWith(fields: Record<string, unknown>[], values: Record<string, unknown> = {}) {
  const httpRequester = { query: jest.fn(), stream: jest.fn() } as unknown as HttpRequester;
  const collection = new Collection('users', httpRequester, {
    users: {
      act: {
        id: 'users-act',
        name: 'act',
        endpoint: '/forest/actions/act',
        hooks: { load: false, change: [] },
        fields: fields.map(field => ({ isRequired: false, isReadOnly: false, ...field })),
      },
    },
  } as never);
  const action = await collection.action('act');
  await action.setFields(values);

  return action;
}

describe('findActionValueProblems', () => {
  it('should list the required fields left empty', async () => {
    const form = await formWith([
      { field: 'reason', type: 'String', isRequired: true },
      { field: 'note', type: 'String' },
    ]);

    expect(findActionValueProblems(form)).toEqual({
      missingRequiredFields: ['reason'],
      invalidValues: [],
    });
  });

  it.each([
    ['a Number', { type: 'Number' }, '12', 'a number'],
    ['a Boolean', { type: 'Boolean' }, 'yes', 'a boolean'],
    ['a String', { type: 'String' }, 12, 'a string'],
    ['an Enum', { type: 'Enum', enums: ['low', 'high'] }, 'mid', 'one of: low, high'],
    ['a list', { type: ['Number'] }, 3, 'an array of a number'],
    ['an item of a list', { type: ['Number'] }, [1, 'x'], 'index 1 to be a number'],
    ['a reference', { type: 'String', reference: 'users.id' }, { id: 1 }, 'a record id'],
  ])('should refuse %s of the wrong type', async (_, declared, value, expected) => {
    const form = await formWith([{ field: 'value', ...declared }], { value });

    expect(findActionValueProblems(form).invalidValues).toEqual([{ field: 'value', expected }]);
  });

  it.each([
    ['a Number', { type: 'Number' }, 12],
    ['an Enum without options', { type: 'Enum' }, 'anything'],
    ['a reference by number', { type: 'Number', reference: 'users.id' }, 7],
    ['a reference by string', { type: 'String', reference: 'users.id' }, 'a|b'],
    ['a Json', { type: 'Json' }, { any: 'thing' }],
  ])('should accept %s', async (_, declared, value) => {
    const form = await formWith([{ field: 'value', ...declared }], { value });

    expect(findActionValueProblems(form).invalidValues).toEqual([]);
  });
});
