import transformUniqueValues from '../../../src/decorators/computed/utils/deduplication';
import {
  flatten,
  unflatten,
  withNullMarkers,
} from '../../../src/decorators/computed/utils/flattener';

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
});
