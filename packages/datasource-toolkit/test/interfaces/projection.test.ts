import Projection from '../../src/interfaces/query/projection';
import * as factories from '../__factories__';

describe('Projection', () => {
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
            id: factories.columnSchema.isPrimaryKey().build(),
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
            key1: factories.columnSchema.isPrimaryKey().build(),
            key2: factories.columnSchema.isPrimaryKey().build(),
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
              id: factories.columnSchema.isPrimaryKey().build(),
              name: factories.columnSchema.build(),
              owner: factories.oneToOneSchema.build({
                foreignCollection: 'owner',
                foreignKey: 'id',
              }),
            },
          }),
        }),
        factories.collection.build({
          name: 'owner',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
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
    });
  });
});
