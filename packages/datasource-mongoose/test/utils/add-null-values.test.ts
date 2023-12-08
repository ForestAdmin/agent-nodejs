import addNullValues from '../../src/utils/add-null-values';

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
});
