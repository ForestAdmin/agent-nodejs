/* eslint-disable */
import flatten from '../src/code';

describe('should flatten records', () => {
  const recordWithCollection = {
    collection: 'user',
    record: {
      id: 1,
      name: 'toto',
      address: { streetName: 'rue de la paix', streetNumber: 1, city: 'Paris' },
      metadata: {
        tags: [
          { id: 1, name: 'tag1', nested: { id: 1 } },
          { id: 2, name: 'tag2', nested: { id: 2 } },
        ],
      },
    },
  };

  test('should work with only fields', () => {
    const asFields = ['address.streetName', 'address.streetNumber', 'address.city'];

    expect(flatten(recordWithCollection, asFields, [])).toEqual([
      {
        collection: 'user',
        record: {
          id: 1,
          name: 'toto',
          'address@@@streetName': 'rue de la paix',
          'address@@@streetNumber': 1,
          'address@@@city': 'Paris',
          metadata: recordWithCollection.record.metadata,
        },
      },
    ]);
  });

  test('should work with only models', () => {
    const asModels = ['address', 'metadata.tags'];

    expect(flatten(recordWithCollection, [], asModels)).toEqual([
      {
        collection: 'user.address',
        record: { streetName: 'rue de la paix', streetNumber: 1, city: 'Paris' },
      },
      { collection: 'user.metadata.tags', record: { id: 1, name: 'tag1', nested: { id: 1 } } },
      { collection: 'user.metadata.tags', record: { id: 2, name: 'tag2', nested: { id: 2 } } },
      { collection: 'user', record: { id: 1, name: 'toto' } },
    ]);
  });
});
