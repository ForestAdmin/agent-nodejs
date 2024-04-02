import type { LegacyIntrospection, Table } from '../../src/introspection/types';

import listCollectionsFromIntrospection from '../../src/introspection/list-collections-from-introspection';

describe('listCollectionsFromIntrospection', () => {
  it('should return an empty array if introspection is falsy', () => {
    const result = listCollectionsFromIntrospection(undefined as unknown as LegacyIntrospection);
    expect(result).toEqual([]);
  });

  it('should return the list of table names if introspection is an array', () => {
    const introspection = [{ name: 'table1' }, { name: 'table2' }] as Table[];

    const result = listCollectionsFromIntrospection(introspection);

    expect(result).toEqual(['table1', 'table2']);
  });

  it('should return the list of table names if introspection is an object', () => {
    const introspection = {
      tables: [{ name: 'table1' }, { name: 'table2' }],
    } as LegacyIntrospection;

    const result = listCollectionsFromIntrospection(introspection);

    expect(result).toEqual(['table1', 'table2']);
  });
});
