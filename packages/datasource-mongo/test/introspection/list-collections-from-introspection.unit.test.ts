import type { Introspection } from '../../src/introspection/types';

import listCollectionsFromIntrospection from '../../src/introspection/list-collections-from-introspection';

describe('listCollectionsFromIntrospection', () => {
  it('should return an empty array if introspection is falsy', () => {
    const result = listCollectionsFromIntrospection(undefined as unknown as Introspection);
    expect(result).toEqual([]);
  });

  it('should return the list of collection names', () => {
    const introspection: Introspection = {
      models: [{ name: 'collection1' }, { name: 'collection2' }],
    } as Introspection;

    const result = listCollectionsFromIntrospection(introspection);

    expect(result).toEqual(['collection1', 'collection2']);
  });
});
