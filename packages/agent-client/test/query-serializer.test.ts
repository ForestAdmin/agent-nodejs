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

    describe('pagination', () => {
      it('should serialize pagination with both size and number', () => {
        const result = QuerySerializer.serialize({ pagination: { size: 10, number: 2 } }, 'users');
        expect(result['page[size]']).toBe(10);
        expect(result['page[number]']).toBe(2);
      });

      it('should serialize pagination with only size', () => {
        const result = QuerySerializer.serialize({ pagination: { size: 25 } }, 'users');
        expect(result['page[size]']).toBe(25);
        expect(result['page[number]']).toBeUndefined();
      });

      it('should serialize pagination with only number', () => {
        const result = QuerySerializer.serialize({ pagination: { number: 5 } }, 'users');
        expect(result['page[size]']).toBeUndefined();
        expect(result['page[number]']).toBe(5);
      });

      it('should handle pagination with size of 0', () => {
        const result = QuerySerializer.serialize({ pagination: { size: 0, number: 1 } }, 'users');
        expect(result['page[size]']).toBe(0);
        expect(result['page[number]']).toBe(1);
      });

      it('should handle pagination with number of 0', () => {
        const result = QuerySerializer.serialize({ pagination: { size: 10, number: 0 } }, 'users');
        expect(result['page[size]']).toBe(10);
        expect(result['page[number]']).toBe(0);
      });

      it('should handle large pagination values', () => {
        const result = QuerySerializer.serialize(
          { pagination: { size: 1000000, number: 999999 } },
          'users',
        );
        expect(result['page[size]']).toBe(1000000);
        expect(result['page[number]']).toBe(999999);
      });

      it('should handle empty pagination object', () => {
        const result = QuerySerializer.serialize({ pagination: {} }, 'users');
        expect(result['page[size]']).toBeUndefined();
        expect(result['page[number]']).toBeUndefined();
      });

      it('should handle undefined pagination', () => {
        const result = QuerySerializer.serialize({ pagination: undefined }, 'users');
        expect(result['page[size]']).toBeUndefined();
        expect(result['page[number]']).toBeUndefined();
      });

      it('should serialize pagination combined with other options', () => {
        const result = QuerySerializer.serialize(
          {
            search: 'john',
            pagination: { size: 15, number: 3 },
            fields: ['id', 'name'],
          },
          'users',
        );
        expect(result.search).toBe('john');
        expect(result['page[size]']).toBe(15);
        expect(result['page[number]']).toBe(3);
        expect(result['fields[users]']).toEqual(['id', 'name']);
      });
    });

    it('should serialize fields with escaped collection name', () => {
      const result = QuerySerializer.serialize({ fields: ['id', 'name', 'email'] }, 'users');
      expect(result['fields[users]']).toEqual(['id', 'name', 'email']);
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
      const filters = {
        field: 'status',
        operator: 'Equal' as const,
        value: 'active',
      };
      const result = QuerySerializer.serialize({ filters }, 'users');
      expect(result.filters).toBe(JSON.stringify(filters));
    });

    it('should serialize complex query with multiple options', () => {
      const filters = {
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
          fields: ['id', 'name'],
          sort: { field: 'createdAt', ascending: false },
          filters,
        },
        'users',
      );

      expect(result.search).toBe('john');
      expect(result['page[size]']).toBe(20);
      expect(result['page[number]']).toBe(1);
      expect(result['fields[users]']).toEqual(['id', 'name']);
      expect(result.sort).toBe('-createdAt');
      expect(result.filters).toBe(JSON.stringify(filters));
    });

    it('should handle collection names with special characters', () => {
      const result = QuerySerializer.serialize({ fields: ['id'] }, 'user+data');
      expect(result['fields[user\\+data]']).toEqual(['id']);
    });

    it('should handle undefined sort', () => {
      const result = QuerySerializer.serialize({ sort: undefined }, 'users');
      expect(result.sort).toBeUndefined();
    });

    it('should handle undefined filters', () => {
      const result = QuerySerializer.serialize({ filters: undefined }, 'users');
      expect(result.filters).toBeUndefined();
    });

    describe('fields with @@@ separator for relations', () => {
      it('should handle single relation field with @@@ separator', () => {
        const result = QuerySerializer.serialize({ fields: ['id', 'customer@@@name'] }, 'orders');

        // Main collection should have id and the relation name (customer)
        expect(result['fields[orders]']).toContain('id');
        expect(result['fields[orders]']).toContain('customer');
        // Related collection should have the field name
        expect(result['fields[customer]']).toContain('name');
      });

      it('should handle multiple relation fields from the same relation', () => {
        const result = QuerySerializer.serialize(
          { fields: ['id', 'customer@@@name', 'customer@@@email'] },
          'orders',
        );

        // Main collection should have id and the relation name (customer) - may appear twice
        expect(result['fields[orders]']).toContain('id');
        expect(result['fields[orders]']).toContain('customer');
        // Related collection should have both field names
        expect(result['fields[customer]']).toContain('name');
        expect(result['fields[customer]']).toContain('email');
      });

      it('should handle multiple different relations', () => {
        const result = QuerySerializer.serialize(
          { fields: ['id', 'customer@@@name', 'product@@@title'] },
          'orders',
        );

        // Main collection should have id and both relation names
        expect(result['fields[orders]']).toContain('id');
        expect(result['fields[orders]']).toContain('customer');
        expect(result['fields[orders]']).toContain('product');
        // Each related collection should have its field
        expect(result['fields[customer]']).toContain('name');
        expect(result['fields[product]']).toContain('title');
      });

      it('should only process first level of relation with multiple @@@ separators', () => {
        const result = QuerySerializer.serialize(
          { fields: ['id', 'customer@@@address@@@city'] },
          'orders',
        );

        // Main collection should have id and customer relation
        expect(result['fields[orders]']).toContain('id');
        expect(result['fields[orders]']).toContain('customer');
        // Only first level is processed - "address@@@city" becomes the field name
        expect(result['fields[customer]']).toContain('address@@@city');
        // No further nesting - address collection should not exist
        expect(result['fields[address]']).toBeUndefined();
      });

      it('should handle only relation fields without simple fields', () => {
        const result = QuerySerializer.serialize(
          { fields: ['customer@@@name', 'customer@@@email'] },
          'orders',
        );

        // Main collection should only have the relation name
        expect(result['fields[orders]']).toContain('customer');
        expect(result['fields[orders]']).not.toContain('name');
        expect(result['fields[orders]']).not.toContain('email');
        // Related collection should have both fields
        expect(result['fields[customer]']).toContain('name');
        expect(result['fields[customer]']).toContain('email');
      });

      it('should escape special characters in relation names', () => {
        const result = QuerySerializer.serialize({ fields: ['id', 'user+data@@@name'] }, 'orders');

        expect(result['fields[orders]']).toContain('id');
        expect(result['fields[orders]']).toContain('user+data');
        expect(result['fields[user\\+data]']).toContain('name');
      });

      it('should handle empty fields array', () => {
        const result = QuerySerializer.serialize({ fields: [] }, 'orders');

        // Empty array should not produce any fields key (no [""])
        expect(result['fields[orders]']).toBeUndefined();
      });

      it('should skip empty strings in fields', () => {
        const result = QuerySerializer.serialize({ fields: ['', 'name', ''] }, 'users');

        expect(result['fields[users]']).toEqual(['name']);
      });

      it('should skip malformed @@@ separator with missing relation name', () => {
        const result = QuerySerializer.serialize({ fields: ['id', '@@@fieldName'] }, 'orders');

        // Should only include 'id', skip the malformed '@@@fieldName'
        expect(result['fields[orders]']).toEqual(['id']);
      });

      it('should skip malformed @@@ separator with missing field name', () => {
        const result = QuerySerializer.serialize({ fields: ['id', 'customer@@@'] }, 'orders');

        // Should only include 'id', skip the malformed 'customer@@@'
        expect(result['fields[orders]']).toEqual(['id']);
      });

      it('should skip standalone @@@ separator', () => {
        const result = QuerySerializer.serialize({ fields: ['id', '@@@'] }, 'orders');

        // Should only include 'id', skip the malformed '@@@'
        expect(result['fields[orders]']).toEqual(['id']);
      });

      it('should not include duplicate relation names', () => {
        const result = QuerySerializer.serialize(
          { fields: ['id', 'customer@@@name', 'customer@@@email'] },
          'orders',
        );

        // customer should only appear once in the orders fields
        const ordersFields = result['fields[orders]'] as string[];
        const customerCount = ordersFields.filter(f => f === 'customer').length;
        expect(customerCount).toBe(1);
      });

      it('should not include duplicate field names', () => {
        const result = QuerySerializer.serialize({ fields: ['id', 'id', 'name', 'name'] }, 'users');

        expect(result['fields[users]']).toEqual(['id', 'name']);
      });

      it('should handle whitespace in field names', () => {
        const result = QuerySerializer.serialize({ fields: ['  id  ', '  name  '] }, 'users');

        expect(result['fields[users]']).toEqual(['id', 'name']);
      });

      it('should handle whitespace around @@@ separator', () => {
        const result = QuerySerializer.serialize({ fields: ['  customer  @@@  name  '] }, 'orders');

        expect(result['fields[orders]']).toContain('customer');
        expect(result['fields[customer]']).toContain('name');
      });
    });
  });
});
