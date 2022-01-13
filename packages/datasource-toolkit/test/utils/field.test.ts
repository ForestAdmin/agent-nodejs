import { PrimitiveTypes, FieldTypes } from '../../src/interfaces/schema';
import FieldUtils from '../../src/utils/field';
import * as factories from '../__factories__';

describe('FieldUtils', () => {
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
          authorId: {
            type: FieldTypes.OneToMany,
          },
        },
      }),
    });
    test('should not throw if the field exist on the collection', () => {
      expect(() => FieldUtils.validate(collection, 'id')).not.toThrow();
    });

    test('should throw if the field is not of column type', () => {
      expect(() => FieldUtils.validate(collection, 'authorId')).toThrow();
    });
  });
});
