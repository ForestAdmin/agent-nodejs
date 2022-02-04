import { flatten, unflatten } from '../../../dist/decorators/computed/utils/flattener';
import transformUniqueValues from '../../../dist/decorators/computed/utils/deduplication';

describe('flattener', () => {
  test('unflatten', () => {
    const result = unflatten(
      [
        [1, 2, 3],
        ['romain', undefined, 'ana'],
      ],
      ['id', 'book:author:firstname'],
    );

    expect(result).toEqual([
      { id: 1, book: { author: { firstname: 'romain' } } },
      { id: 2, book: null },
      { id: 3, book: { author: { firstname: 'ana' } } },
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
    const handler = jest
      .fn()
      .mockImplementation(async (values: number[]) =>
        values.map(value => (value ? value * 2 : value)),
      );

    const result = await transformUniqueValues(inputs, handler);

    expect(result).toEqual([2, null, 4, 4, null, 1332]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith([1, null, 2, 666]);
  });
});
