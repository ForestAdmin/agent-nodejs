import Sort from '../../dist/interfaces/query/sort';
import { PrimitiveTypes } from '../../dist/interfaces/schema';
import SortValidator from '../../dist/validation/sort';
import * as factories from '../__factories__';

describe('SortValidator', () => {
  describe('validate', () => {
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
          },
        }),
      }),
    ]);

    test('should not throw if the field exist on the collection', () => {
      expect(() =>
        SortValidator.validate(
          dataSource.getCollection('cars'),
          new Sort({ field: 'id', ascending: true }),
        ),
      ).not.toThrow();
    });

    test('should throw if the field does not exist on the collection', () => {
      expect(() =>
        SortValidator.validate(
          dataSource.getCollection('cars'),
          new Sort({ field: '__no__such__field', ascending: true }),
        ),
      ).toThrow();
    });

    test('should not throw if the ascending parameter is boolean', () => {
      expect(() =>
        SortValidator.validate(
          dataSource.getCollection('cars'),
          new Sort({ field: 'id', ascending: true }),
        ),
      ).not.toThrow();
    });

    test('should throw if the ascending parameter is not boolean', () => {
      expect(() =>
        SortValidator.validate(
          dataSource.getCollection('cars'),
          new Sort({ field: 'id', ascending: 42 as unknown as boolean }),
        ),
      ).toThrow();
    });
  });
});
