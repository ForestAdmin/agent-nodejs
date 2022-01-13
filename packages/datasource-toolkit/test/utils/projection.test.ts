import { PrimitiveTypes, FieldTypes } from '../../src/interfaces/schema';
import ProjectionUtils from '../../src/utils/projection';
import * as factories from '../__factories__';

describe('ProjectionUtils', () => {
  describe('validate', () => {
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          id: { type: FieldTypes.Column, columnType: PrimitiveTypes.Uuid, isPrimaryKey: true },
          author: {
            type: FieldTypes.ManyToOne,
            foreignCollection: 'persons',
            foreignKey: 'authorId',
          },
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
          id: { type: FieldTypes.Column, columnType: PrimitiveTypes.Uuid, isPrimaryKey: true },
          name: { type: FieldTypes.Column, columnType: PrimitiveTypes.String },
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
            key1: { type: FieldTypes.Column, columnType: PrimitiveTypes.Uuid, isPrimaryKey: true },
            key2: { type: FieldTypes.Column, columnType: PrimitiveTypes.Uuid, isPrimaryKey: true },
            name: { type: FieldTypes.Column, columnType: PrimitiveTypes.String },
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
  });
});
