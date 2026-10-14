import Projection from '../../src/interfaces/query/projection';
import * as factories from '../__factories__';

describe('Projection', () => {
  describe('equals()', () => {
    test('should work', () => {
      const projection1 = new Projection('id', 'name', 'address');
      const projection2 = new Projection('id', 'name');
      const projection3 = new Projection('id', 'name');

      expect(projection1.equals(projection2)).toBe(false);
      expect(projection2.equals(projection3)).toBe(true);
    });

    test('should ignore the order of the fields', () => {
      expect(new Projection('id', 'name').equals(new Projection('name', 'id'))).toBe(true);
    });

    test('should be false when a field is missing from a projection of the same length', () => {
      expect(new Projection('id', 'name').equals(new Projection('id', 'title'))).toBe(false);
    });
  });

  describe('relations', () => {
    test('should group the sub-paths by relation, in order of first appearance', () => {
      const { relations } = new Projection(
        'id',
        'owner:name',
        'author:id',
        'owner:address:city',
        'owner:id',
      );

      expect(Object.keys(relations)).toEqual(['owner', 'author']);
      expect(relations.owner).toStrictEqual(new Projection('name', 'address:city', 'id'));
      expect(relations.author).toStrictEqual(new Projection('id'));
    });
  });

  describe('replace()', () => {
    test('should remove duplicates', () => {
      const projection = new Projection('id', 'name').replace(() => 'id');

      expect(projection).toEqual(['id']);
    });

    test('should allow replacing one field by many', () => {
      const projection = new Projection('id', 'name').replace(field =>
        field === 'name' ? ['firstName', 'lastName'] : field,
      );

      expect(projection).toEqual(['id', 'firstName', 'lastName']);
    });

    test('should keep the first appearance of each field across replacements', () => {
      const projection = new Projection('name', 'id', 'title').replace(field =>
        field === 'name' ? new Projection('firstName', 'id') : [field, 'firstName'],
      );

      expect(projection).toStrictEqual(new Projection('firstName', 'id', 'title'));
    });

    test('should drop the fields replaced by nothing', () => {
      const projection = new Projection('id', 'name', 'title').replace(field =>
        field === 'name' ? null : field,
      );

      expect(projection).toStrictEqual(new Projection('id', 'title'));
    });
  });

  describe('apply()', () => {
    test('should reproject a list of records', () => {
      const projection = new Projection('id', 'name', 'author:name', 'other:id');

      expect(
        projection.apply([
          {
            id: 1,
            name: 'romain',
            age: 12,
            author: { name: 'ana', lastname: 'something' },
            other: null,
          },
        ]),
      ).toStrictEqual([
        {
          id: 1,
          name: 'romain',
          author: { name: 'ana' },
          other: null,
        },
      ]);
    });

    test('should reproject nested relations and leave missing or empty ones null', () => {
      const projection = new Projection('id', 'author:name', 'author:country:code', 'editor:id');

      expect(
        projection.apply([
          { id: 1, author: { name: 'ana', age: 3, country: { code: 'FR', name: 'France' } } },
          { id: 2, author: { name: 'bob', country: null }, editor: undefined },
          null,
        ]),
      ).toStrictEqual([
        { id: 1, author: { name: 'ana', country: { code: 'FR' } }, editor: null },
        { id: 2, author: { name: 'bob', country: null }, editor: null },
        null,
      ]);
    });

    test('should put the columns before the relations', () => {
      const [record] = new Projection('author:name', 'id').apply([
        { author: { name: 'ana' }, id: 1 },
      ]);

      expect(Object.keys(record)).toEqual(['id', 'author']);
    });

    test('should not modify the records it is given', () => {
      const record = { id: 1, age: 12, author: { name: 'ana', lastname: 'something' } };

      new Projection('id', 'author:name').apply([record]);

      expect(record).toStrictEqual({
        id: 1,
        age: 12,
        author: { name: 'ana', lastname: 'something' },
      });
    });

    test('should not regroup the relations for every record', () => {
      const projection = new Projection('id', 'author:name', 'author:country:code');
      const relations = jest.spyOn(Projection.prototype, 'relations', 'get');
      const record = { id: 1, author: { name: 'ana', country: { code: 'FR' } } };

      projection.apply([record]);
      const callsForOneRecord = relations.mock.calls.length;
      relations.mockClear();
      projection.apply(Array.from({ length: 50 }, () => record));
      const callsForFiftyRecords = relations.mock.calls.length;
      relations.mockRestore();

      expect(callsForFiftyRecords).toBe(callsForOneRecord);
    });
  });

  describe('nest()', () => {
    test('should do nothing with null', () => {
      const projection = new Projection('id', 'name', 'author:name', 'other:id');

      expect(projection.nest(null)).toEqual(projection);
    });

    test('should work with a prefix', () => {
      const projection = new Projection('id', 'name', 'author:name', 'other:id');

      expect(projection.nest('prefix')).toEqual([
        'prefix:id',
        'prefix:name',
        'prefix:author:name',
        'prefix:other:id',
      ]);
    });
  });

  describe('unnest()', () => {
    test('should work when all paths share a prefix', () => {
      const projection = new Projection('id', 'name', 'author:name', 'other:id');

      expect(projection.nest('prefix').unnest()).toEqual(projection);
    });

    test('should throw when not possible', () => {
      const projection = new Projection('id', 'name', 'author:name', 'other:id');

      expect(() => projection.unnest()).toThrow('Cannot unnest projection');
    });
  });

  describe('withPks', () => {
    describe('when the pk is a single field', () => {
      const collection = factories.collection.build({
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            name: factories.columnSchema.build(),
          },
        }),
      });

      test('should automatically add pks to the provided projection', () => {
        expect(new Projection('name').withPks(collection)).toEqual(['name', 'id']);
      });

      test('should do nothing when the pks are already provided', () => {
        expect(new Projection('id', 'name').withPks(collection)).toEqual(['id', 'name']);
      });
    });

    describe('when the pk is a composite', () => {
      const collection = factories.collection.build({
        schema: factories.collectionSchema.build({
          fields: {
            key1: factories.columnSchema.uuidPrimaryKey().build(),
            key2: factories.columnSchema.uuidPrimaryKey().build(),
            name: factories.columnSchema.build(),
          },
        }),
      });

      test('should automatically add pks to the provided projection', () => {
        expect(new Projection('name').withPks(collection)).toEqual(['name', 'key1', 'key2']);
      });
    });

    describe('when dealing with projection using relationships', () => {
      const dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'cars',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.uuidPrimaryKey().build(),
              name: factories.columnSchema.build(),
              owner: factories.oneToOneSchema.build({
                foreignCollection: 'owner',
                originKey: 'id', // the ids of both collection are the same
                originKeyTarget: 'id',
              }),
            },
          }),
        }),
        factories.collection.build({
          name: 'owner',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.uuidPrimaryKey().build(),
              name: factories.columnSchema.build(),
            },
          }),
        }),
      ]);

      test('should automatically add pks for all relations', () => {
        const collection = dataSource.getCollection('cars');
        const projection = new Projection('name', 'owner:name').withPks(collection);
        expect(projection).toEqual(['name', 'owner:name', 'id', 'owner:id']);
      });

      test('should not repeat a relation pk that is already projected', () => {
        const collection = dataSource.getCollection('cars');
        const projection = new Projection('owner:id', 'owner:name').withPks(collection);

        expect(projection).toEqual(['owner:id', 'owner:name', 'id']);
      });
    });

    test('should not modify the projection it is called on', () => {
      const collection = factories.collection.build({
        schema: factories.collectionSchema.build({
          fields: { id: factories.columnSchema.uuidPrimaryKey().build() },
        }),
      });
      const projection = new Projection('name');

      projection.withPks(collection);

      expect(projection).toEqual(['name']);
    });
  });

  describe('union', () => {
    it('should work with two projections', () => {
      const projection1 = new Projection('id', 'title');
      const projection2 = new Projection('id', 'amount');

      expect(projection1.union(projection2)).toStrictEqual(new Projection('id', 'title', 'amount'));
    });

    it('should work with a null projection', () => {
      const projection = new Projection('id', 'title');

      expect(projection.union(null)).toStrictEqual(projection);
    });

    it('should keep the first appearance of each field across projections', () => {
      const projection = new Projection('id', 'title').union(
        ['amount', 'id'],
        null,
        new Projection('title', 'date', 'amount'),
      );

      expect(projection).toStrictEqual(new Projection('id', 'title', 'amount', 'date'));
    });

    it('should return a new projection', () => {
      const projection = new Projection('id');
      const union = projection.union([]);

      union.push('title');

      expect(projection).toEqual(['id']);
    });
  });
});
