import QuerySerializer from '../src/query-serializer';

describe('QuerySerializer', () => {
  describe('serialize', () => {
    it('should return empty object when query is undefined', () => {
      const result = QuerySerializer.serialize(undefined, 'users');
      expect(result).toEqual({});
    });

    it('should return empty object when query is null', () => {
      const result = QuerySerializer.serialize(null as any, 'users');
      expect(result).toEqual({});
    });

    it('should serialize search query', () => {
      const result = QuerySerializer.serialize({ search: 'john' }, 'users');
      expect(result.search).toBe('john');
    });

    it('should serialize pagination', () => {
      const result = QuerySerializer.serialize(
        { pagination: { size: 10, number: 2 } },
        'users',
      );
      expect(result['page[size]']).toBe(10);
      expect(result['page[number]']).toBe(2);
    });

    it('should serialize projection with escaped collection name', () => {
      const result = QuerySerializer.serialize(
        { projection: ['id', 'name', 'email'] },
        'users',
      );
      expect(result['fields[users]']).toBe('id,name,email');
    });

    it('should serialize ascending sort', () => {
      const result = QuerySerializer.serialize(
        { sort: { field: 'name', ascending: true } },
        'users',
      );
      expect(result.sort).toBe('name');
    });

    it('should serialize descending sort', () => {
      const result = QuerySerializer.serialize(
        { sort: { field: 'name', ascending: false } },
        'users',
      );
      expect(result.sort).toBe('-name');
    });

    it('should serialize filters with conditionTree', () => {
      const conditionTree = {
        field: 'status',
        operator: 'Equal' as const,
        value: 'active',
      };
      const result = QuerySerializer.serialize(
        { filters: { conditionTree } },
        'users',
      );
      expect(result.filters).toBe(JSON.stringify(conditionTree));
    });

    it('should serialize complex query with multiple options', () => {
      const conditionTree = {
        aggregator: 'And' as const,
        conditions: [
          { field: 'status', operator: 'Equal' as const, value: 'active' },
          { field: 'age', operator: 'GreaterThan' as const, value: 18 },
        ],
      };
      const result = QuerySerializer.serialize(
        {
          search: 'john',
          pagination: { size: 20, number: 1 },
          projection: ['id', 'name'],
          sort: { field: 'createdAt', ascending: false },
          filters: { conditionTree },
        },
        'users',
      );

      expect(result.search).toBe('john');
      expect(result['page[size]']).toBe(20);
      expect(result['page[number]']).toBe(1);
      expect(result['fields[users]']).toBe('id,name');
      expect(result.sort).toBe('-createdAt');
      expect(result.filters).toBe(JSON.stringify(conditionTree));
    });

    it('should handle collection names with special characters', () => {
      const result = QuerySerializer.serialize(
        { projection: ['id'] },
        'user+data',
      );
      expect(result['fields[user\\+data]']).toBe('id');
    });

    it('should handle undefined sort', () => {
      const result = QuerySerializer.serialize({ sort: undefined }, 'users');
      expect(result.sort).toBeUndefined();
    });

    it('should handle undefined filters', () => {
      const result = QuerySerializer.serialize({ filters: undefined }, 'users');
      expect(result.filters).toBeUndefined();
    });

    it('should handle undefined pagination', () => {
      const result = QuerySerializer.serialize({ pagination: undefined }, 'users');
      expect(result['page[size]']).toBeUndefined();
      expect(result['page[number]']).toBeUndefined();
    });
  });
});
