import ProjectionValidator from '../../src/validation/projection';
import * as factories from '../__factories__';

describe('ProjectionValidator', () => {
  describe('validate', () => {
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          author: factories.manyToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'authorId',
          }),
        },
      }),
    });

    test('should not throw if the field exist on the collection', () => {
      expect(() => ProjectionValidator.validate(collection, ['id'])).not.toThrow();
    });

    test('should throw if the field is not of column type', () => {
      expect(() => ProjectionValidator.validate(collection, ['author'])).toThrow();
    });
  });
});
