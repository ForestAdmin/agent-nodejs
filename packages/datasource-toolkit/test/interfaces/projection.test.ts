import Projection from '../../dist/interfaces/query/projection';
import { PrimitiveTypes } from '../../dist/interfaces/schema';
import * as factories from '../__factories__';

describe('Projection', () => {
  describe('always', () => {
    test('replace should remove duplicates', () => {
      const projection = new Projection('id', 'name').replace(() => 'id');

      expect(projection).toEqual(['id']);
    });

    test('replace should allow replacing one field by many', () => {
      const projection = new Projection('id', 'name').replace(field =>
        field === 'name' ? ['firstName', 'lastName'] : field,
      );

      expect(projection).toEqual(['id', 'firstName', 'lastName']);
    });

    test('apply should reproject', () => {
      const projection = new Projection('id', 'name', 'author:name', 'other:id');

      expect(
        projection.apply({
          id: 1,
          name: 'romain',
          age: 12,
          author: { name: 'ana', lastname: 'something' },
          other: null,
        }),
      ).toStrictEqual({
        id: 1,
        name: 'romain',
        author: { name: 'ana' },
        other: null,
      });
    });

    test('nest should work', () => {
      const projection = new Projection('id', 'name', 'author:name', 'other:id');

      expect(projection.nest('prefix')).toEqual([
        'prefix:id',
        'prefix:name',
        'prefix:author:name',
        'prefix:other:id',
      ]);
    });

    test('unnest should work', () => {
      const projection = new Projection('id', 'name', 'author:name', 'other:id');

      expect(projection.nest('prefix').unnest()).toEqual(projection);
    });

    test('unnest should throw when not possible', () => {
      const projection = new Projection('id', 'name', 'author:name', 'other:id');

      expect(() => projection.unnest()).toThrow('Cannot unnest projection');
    });
  });

  describe('when the pk is a single field', () => {
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          }),
          name: factories.columnSchema.build(),
        },
      }),
    });

    test('withPks should automatically add pks to the provided projection', () => {
      expect(new Projection('name').withPks(collection)).toEqual(['name', 'id']);
    });

    test('withPks should do nothing when the pks are already provided', () => {
      expect(new Projection('id', 'name').withPks(collection)).toEqual(['id', 'name']);
    });
  });

  describe('when the pk is a composite', () => {
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          key1: factories.columnSchema.build({
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          }),
          key2: factories.columnSchema.build({
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          }),
          name: factories.columnSchema.build(),
        },
      }),
    });

    test('withPks should automatically add pks to the provided projection', () => {
      expect(new Projection('name').withPks(collection)).toEqual(['name', 'key1', 'key2']);
    });
  });

  describe('when dealing with projection using relationships', () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'cars',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.build({
              columnType: PrimitiveTypes.Uuid,
              isPrimaryKey: true,
            }),
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
            id: factories.columnSchema.build({
              columnType: PrimitiveTypes.Uuid,
              isPrimaryKey: true,
            }),
            name: factories.columnSchema.build(),
          },
        }),
      }),
    ]);

    test('withPks should automatically add pks for all relations', () => {
      expect(
        new Projection('name', 'owner:name').withPks(dataSource.getCollection('cars')),
      ).toEqual(['name', 'owner:name', 'id', 'owner:id']);
    });
  });
});
