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
          authorId: {
            type: FieldTypes.OneToMany,
          },
        },
      }),
    });
    test('should not throw if the field exist on the collection', () => {
      expect(() => ProjectionUtils.validate(collection, ['id'])).not.toThrow();
    });

    test('should throw if the field is not of column type', () => {
      expect(() => ProjectionUtils.validate(collection, ['authorId'])).toThrow();
    });
  });
});
