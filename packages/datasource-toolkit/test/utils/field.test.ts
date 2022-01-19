import { PrimitiveTypes, FieldTypes } from '../../src/interfaces/schema';
import FieldUtils from '../../src/utils/field';
import * as factories from '../__factories__';

describe('FieldUtils', () => {
  describe('validate', () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'cars',
        schema: factories.collectionSchema.build({
          fields: {
            id: {
              type: FieldTypes.Column,
              columnType: PrimitiveTypes.Uuid,
              isPrimaryKey: true,
            },
            name: { type: FieldTypes.Column, columnType: PrimitiveTypes.String },
            owner: {
              type: FieldTypes.OneToOne,
              foreignCollection: 'owner',
              foreignKey: 'id',
            },
          },
        }),
      }),
      factories.collection.build({
        name: 'owner',
        schema: factories.collectionSchema.build({
          fields: {
            id: {
              type: FieldTypes.Column,
              columnType: PrimitiveTypes.Uuid,
              isPrimaryKey: true,
            },
            name: { type: FieldTypes.Column, columnType: PrimitiveTypes.String },
            address: { type: FieldTypes.OneToOne },
          },
        }),
      }),
    ]);

    test('should not throw if the field exist on the collection', () => {
      expect(() => FieldUtils.validate(dataSource.getCollection('cars'), 'id')).not.toThrow();
    });

    test('should throw if the field is not of column type', () => {
      expect(() => FieldUtils.validate(dataSource.getCollection('cars'), 'owner')).toThrow(
        'Unexpected field type: OneToOne for field owner',
      );
    });

    test('should throw un-implemented error when using the values argument', () => {
      expect(() => FieldUtils.validate(dataSource.getCollection('cars'), 'id', [123])).toThrow(
        'Implement me.',
      );
    });

    describe('when validating relationship fields', () => {
      test('should validate fields on other collections', () => {
        expect(() =>
          FieldUtils.validate(dataSource.getCollection('cars'), 'owner:name'),
        ).not.toThrow();
      });

      test('should throw when the requested field is of type column', () => {
        expect(() => FieldUtils.validate(dataSource.getCollection('cars'), 'id:address')).toThrow(
          'Unexpected field type: Column for field id:address',
        );
      });
    });
  });
});
