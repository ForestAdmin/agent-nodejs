import type { ComputedDefinition } from '../../../src/decorators/computed/types';
import type { ColumnType } from '@forestadmin/datasource-toolkit';

import transformUniqueValues from '../../../src/decorators/computed/utils/deduplication';
import {
  flatten,
  unflatten,
  withNullMarkers,
} from '../../../src/decorators/computed/utils/flattener';
import mapDeprecated from '../../../src/decorators/computed/utils/map-deprecated';

describe('flattener', () => {
  test('unflatten simple case', () => {
    const flatList = [
      [1, 2, 3],
      ['romain', undefined, 'ana'],
    ];
    const projection = ['id', 'book:author:firstname'];

    expect(unflatten(flatList, projection)).toEqual([
      { id: 1, book: { author: { firstname: 'romain' } } },
      { id: 2 },
      { id: 3, book: { author: { firstname: 'ana' } } },
    ]);
  });

  test('unflatten with multiple undefined', () => {
    const flatList = [[undefined], [15], [26], [undefined]];
    const projection = [
      'rental:customer:name',
      'rental:id',
      'rental:numberOfDays',
      'rental:customer:id',
    ];

    expect(unflatten(flatList, projection)).toEqual([{ rental: { id: 15, numberOfDays: 26 } }]);
  });

  test('flatten', () => {
    const result = flatten(
      [
        { id: 1, book: { author: { firstname: 'romain' } } },
        { id: 2, book: null },
        { id: 3, book: { author: { firstname: 'ana' } } },
      ],
      ['id', 'book:author:firstname'],
    );

    expect(result).toEqual([
      [1, 2, 3],
      ['romain', undefined, 'ana'],
    ]);
  });

  test('round trip with markers should conserve null values', () => {
    const projection = ['id', 'book:author:firstname', 'book:author:lastname'];
    const projectionWithMarkers = withNullMarkers(projection);
    const records = [
      { id: 1 },
      { id: 2, book: null },
      { id: 3, book: { author: null } },
      { id: 4, book: { author: { firstname: 'Isaac', lastname: 'Asimov' } } },
    ];

    const flattened = flatten(records, projectionWithMarkers);
    const unflattened = unflatten(flattened, projectionWithMarkers);

    expect(projectionWithMarkers).toEqual([
      ...projection,
      'book:__nullMarker',
      'book:author:__nullMarker',
    ]);
    expect(flattened).toEqual([
      [1, 2, 3, 4], // id
      [undefined, undefined, undefined, 'Isaac'], // book:author:firstname
      [undefined, undefined, undefined, 'Asimov'], // book:author:lastname
      [undefined, null, undefined, undefined], // book:author:__nullMarker
      [undefined, undefined, null, undefined], // book:__nullMarker
    ]);

    expect(unflattened).toStrictEqual(records);
  });
});

describe('deduplication', () => {
  test('transformUniqueValues', async () => {
    const inputs = [1, null, 2, 2, null, 666];
    const multiplyByTwo = async (values: number[]) => values.map(value => value * 2);
    const handler = jest.fn().mockImplementation(multiplyByTwo);

    const result = await transformUniqueValues(inputs, handler);
    expect(result).toEqual([2, null, 4, 4, null, 1332]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith([1, 2, 666]);
  });

  test('merges records holding equal nested values', async () => {
    const first = { title: 'Foundation', author: { bornAt: new Date(0), tags: ['a', 1] } };
    const second = { title: 'Foundation', author: { bornAt: new Date(0), tags: ['a', 1] } };
    const handler = jest.fn().mockResolvedValue(['computed']);

    const result = await transformUniqueValues([first, second], handler);

    expect(handler).toHaveBeenCalledWith([first]);
    expect(result).toEqual(['computed', 'computed']);
  });

  test('merges records holding the same symbol', async () => {
    const symbol = Symbol('a');
    const first = { value: symbol };
    const second = { value: symbol };
    const handler = jest.fn().mockResolvedValue(['computed']);

    const result = await transformUniqueValues([first, second], handler);

    expect(handler).toHaveBeenCalledWith([first]);
    expect(result).toEqual(['computed', 'computed']);
  });

  test('merges structurally equal records holding a cycle', async () => {
    const first: Record<string, unknown> = { title: 'Foundation' };
    const second: Record<string, unknown> = { title: 'Foundation' };
    first.self = first;
    second.self = second;
    const handler = jest.fn().mockResolvedValue(['computed']);

    const result = await transformUniqueValues([first, second], handler);

    expect(handler).toHaveBeenCalledWith([first]);
    expect(result).toEqual(['computed', 'computed']);
  });

  test('keeps records holding a cycle apart when their values differ', async () => {
    const first: Record<string, unknown> = { title: 'Foundation' };
    const second: Record<string, unknown> = { title: 'Dune' };
    first.self = first;
    second.self = second;
    const handler = jest.fn().mockResolvedValue(['first', 'second']);

    const result = await transformUniqueValues([first, second], handler);

    expect(handler).toHaveBeenCalledWith([first, second]);
    expect(result).toEqual(['first', 'second']);
  });

  test.each([
    ['NaN and null', { value: NaN }, { value: null }],
    ['a date and its ISO string', { value: new Date(0) }, { value: new Date(0).toISOString() }],
    ['a number and its string', { value: 1 }, { value: '1' }],
    ['a bigint and a number', { value: BigInt(1) }, { value: 1 }],
    ['a boolean and its string', { value: true }, { value: 'true' }],
    ['an object and its JSON string', { value: { a: 1 } }, { value: '{"a":1}' }],
    ['an undefined and a missing key', { value: undefined }, {}],
    ['different buffers', { value: Buffer.from('a') }, { value: Buffer.from('b') }],
    ['different maps', { value: new Map([['a', 1]]) }, { value: new Map([['a', 2]]) }],
    ['a string holding a separator', { a: 'x,"b":"y' }, { a: 'x', b: 'y' }],
    ['different symbols', { value: Symbol('a') }, { value: Symbol('b') }],
    ['different symbols with the same description', { value: Symbol('a') }, { value: Symbol('a') }],
    ['zero and negative zero', { value: 0 }, { value: -0 }],
    ['an array with a hole and an empty array', { value: [,] }, { value: [] }], // eslint-disable-line no-sparse-arrays
  ])('keeps %s apart', async (_, first, second) => {
    const handler = jest.fn().mockResolvedValue(['first', 'second']);

    const result = await transformUniqueValues<object, string>([first, second], handler);

    expect(handler).toHaveBeenCalledWith([first, second]);
    expect(result).toEqual(['first', 'second']);
  });
});

describe('deprecation-map', () => {
  describe('for deprecated columnType (Timeonly)', () => {
    test('it should map the column type to a non deprecated and leave the rest', async () => {
      const input = {
        columnType: 'Timeonly',
        dependencies: ['dep'],
        getValues: records => records.map(() => 'abc'),
      } as ComputedDefinition;
      expect(mapDeprecated(input)).toStrictEqual({
        columnType: 'Time',
        dependencies: ['dep'],
        getValues: expect.any(Function),
      });
    });
  });

  describe.each([
    'String',
    'Binary',
    'Boolean',
    'Date',
    'Dateonly',
    'Enum',
    'Json',
    'Number',
    'Point',
    'Time',
    'Uuid',
  ] as ColumnType[])('for a non deprecated columnType %s', columnType => {
    test('it should leave the definition as is', async () => {
      const input = {
        columnType,
        dependencies: ['dep'],
        getValues: records => records.map(() => 'abc'),
      } as ComputedDefinition;
      expect(mapDeprecated(input)).toStrictEqual({
        columnType,
        dependencies: ['dep'],
        getValues: expect.any(Function),
      });
    });
  });
});
