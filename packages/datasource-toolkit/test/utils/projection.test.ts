import { PrimitiveTypes } from '../../src/interfaces/schema';
import ProjectionUtils from '../../src/utils/projection';
import * as factories from '../__factories__';

describe('ProjectionUtils', () => {
  describe('validate', () => {
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid, isPrimaryKey: true }),
          author: factories.manyToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'authorId',
          }),
        },
      }),
    });

    test('should not throw if the field exist on the collection', () => {
      expect(() => ProjectionUtils.validate(collection, ['id'])).not.toThrow();
    });

    test('should throw if the field is not of column type', () => {
      expect(() => ProjectionUtils.validate(collection, ['author'])).toThrow();
    });
  });

  describe('withPks', () => {
    const singlePKCollection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid, isPrimaryKey: true }),
          name: factories.columnSchema.build(),
        },
      }),
    });
    describe('when the pk is a single field', () => {
      test('should automatically add pks to the provided projection', () => {
        expect(ProjectionUtils.withPks(singlePKCollection, ['name'])).toEqual(['name', 'id']);
      });

      test('should do nothing when the pks are already provided', () => {
        expect(ProjectionUtils.withPks(singlePKCollection, ['id', 'name'])).toEqual(['id', 'name']);
      });
    });

    describe('when the pk is a composite', () => {
      const compositePKCollection = factories.collection.build({
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

      test('should automatically add pks to the provided projection', () => {
        expect(ProjectionUtils.withPks(compositePKCollection, ['name'])).toEqual([
          'name',
          'key1',
          'key2',
        ]);
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

      test('should automatically add pks for all relations', () => {
        expect(
          ProjectionUtils.withPks(dataSource.getCollection('cars'), ['name', 'owner:name']),
        ).toEqual(['name', 'owner:name', 'id', 'owner:id']);
      });
    });
  });
});
