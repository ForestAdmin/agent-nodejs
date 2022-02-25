import * as factories from '../__factories__';
import Sort from '../../src/interfaces/query/sort/sort';
import SortValidator from '../../src/validation/sort';

describe('SortValidator', () => {
  describe('validate', () => {
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build(),
        },
      }),
    });

    test('should not throw if the field exist on the collection', () => {
      expect(() =>
        SortValidator.validate(collection, new Sort({ field: 'id', ascending: true })),
      ).not.toThrow();
    });

    test('should throw if the field does not exist on the collection', () => {
      expect(() =>
        SortValidator.validate(
          collection,
          new Sort({ field: '__no__such__field', ascending: true }),
        ),
      ).toThrow();
    });

    test('should not throw if the ascending parameter is boolean', () => {
      expect(() =>
        SortValidator.validate(collection, new Sort({ field: 'id', ascending: true })),
      ).not.toThrow();
    });

    test('should throw if the ascending parameter is not boolean', () => {
      expect(() =>
        SortValidator.validate(
          collection,
          new Sort({ field: 'id', ascending: 42 as unknown as boolean }),
        ),
      ).toThrow();
    });
  });
});
