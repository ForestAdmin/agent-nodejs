import addNullValues from '../../src/utils/add-null-values';
import { FOREST_RECORD_DOES_NOT_EXIST } from '../../src/utils/pipeline/condition-generator';

describe('addNullValues', () => {
  it('should return a different object with null values added', () => {
    const input = {
      id: 1,
      name: 'John',
    };
    const projection = ['id', 'name', 'address'];

    const result = addNullValues([input], projection);

    expect(result).not.toBe(input);
    expect(result).toEqual([{ id: 1, name: 'John', address: null }]);
  });

  it('should add null values in nested objects', () => {
    const input = {
      id: 1,
      name: 'John',
      address: {
        street: 'Main Street',
      },
    };
    const projection = ['id', 'name', 'address:street', 'address:city'];

    const result = addNullValues([input], projection);

    expect(result).toEqual([
      {
        id: 1,
        name: 'John',
        address: {
          street: 'Main Street',
          city: null,
        },
      },
    ]);
  });

  it('should add null values in nested arrays', () => {
    const input = {
      id: 1,
      name: 'John',
      addresses: [
        {
          street: 'Main Street',
        },
      ],
    };
    const projection = ['id', 'name', 'addresses:street', 'addresses:city'];

    const result = addNullValues([input], projection);

    expect(result).toEqual([
      {
        id: 1,
        name: 'John',
        addresses: [
          {
            street: 'Main Street',
            city: null,
          },
        ],
      },
    ]);
  });

  it('should add the missing keys in projection order, after the existing ones', () => {
    const [result] = addNullValues(
      [{ name: 'John' }],
      ['address:city', 'id', 'name', 'tags:label'],
    );

    expect(Object.keys(result)).toEqual(['name', 'address', 'id', 'tags']);
  });

  it('should keep null and incomplete items of a nested array', () => {
    const input = { id: 1, addresses: [null, { street: 'Main Street' }, {}] };

    const result = addNullValues([input], ['id', 'addresses:street', 'addresses:city']);

    expect(result).toStrictEqual([
      {
        id: 1,
        addresses: [null, { street: 'Main Street', city: null }, { street: null, city: null }],
      },
    ]);
  });

  it('should leave non-object values of a nested path untouched', () => {
    const input = { label: 'John', count: 0 };

    const result = addNullValues([input], ['label:x', 'count:x']);

    expect(result).toStrictEqual([{ label: 'John', count: 0 }]);
  });

  it('should drop a record and null a relation flagged as not existing', () => {
    const input = [
      { id: 1, [FOREST_RECORD_DOES_NOT_EXIST]: true },
      { id: 2, author: { id: FOREST_RECORD_DOES_NOT_EXIST } },
    ];

    const result = addNullValues(input, ['id', 'author:id']);

    expect(result).toStrictEqual([{ id: 2, author: null }]);
  });

  it('should not modify the records it is given', () => {
    const input = { id: 1, address: { street: 'Main Street' } };

    addNullValues([input], ['id', 'name', 'address:city']);

    expect(input).toStrictEqual({ id: 1, address: { street: 'Main Street' } });
  });

  it('should read the projection the same number of times whatever the record count', () => {
    const readsFor = (count: number) => {
      let reads = 0;
      const projection = new Proxy(['id', 'address:street', 'address:city:zip'], {
        get(target, property, receiver) {
          reads += 1;

          return Reflect.get(target, property, receiver);
        },
      });
      const record = { id: 1, address: { street: 'Main Street', city: {} } };

      addNullValues(
        Array.from({ length: count }, () => record),
        projection,
      );

      return reads;
    };

    expect(readsFor(50)).toBe(readsFor(1));
  });

  it('should return binary values as they are, next to a relation flagged as not existing', () => {
    const picture = Buffer.from('picture');
    const input = { picture, author: { id: FOREST_RECORD_DOES_NOT_EXIST } };

    const [result] = addNullValues([input], ['picture', 'author:id']);

    expect(result.picture).toBe(picture);
    expect(result.author).toBeNull();
  });

  it('should not look for the not-exist marker inside binary values', () => {
    const picture = Buffer.alloc(16);
    const values = jest.spyOn(Object, 'values');

    addNullValues([{ id: 1, picture }], ['id', 'picture']);
    const scannedValues = values.mock.calls.map(([value]) => value);
    values.mockRestore();

    expect(scannedValues).not.toContain(picture);
  });
});
