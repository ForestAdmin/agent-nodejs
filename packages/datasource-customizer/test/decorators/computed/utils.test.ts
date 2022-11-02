import { Projection } from '@forestadmin/datasource-toolkit';

import transformUniqueValues from '../../../src/decorators/computed/utils/deduplication';
import { flatten, unflatten } from '../../../src/decorators/computed/utils/flattener';

describe('flattener', () => {
  test('unflatten simple case', () => {
    const flatList = [
      [1, 2, 3],
      ['romain', undefined, 'ana'],
    ];
    const projection = new Projection('id', 'book:author:firstname');

    expect(unflatten(flatList, projection)).toEqual([
      { id: 1, book: { author: { firstname: 'romain' } } },
      { id: 2, book: null },
      { id: 3, book: { author: { firstname: 'ana' } } },
    ]);
  });

  test('unflatten with multiple undefined', () => {
    const flatList = [[undefined], [15], [26], [undefined]];
    const projection = new Projection(
      'rental:customer:name',
      'rental:id',
      'rental:numberOfDays',
      'rental:customer:id',
    );

    expect(unflatten(flatList, projection)).toEqual([
      { rental: { id: 15, numberOfDays: 26, customer: null } },
    ]);
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
});
