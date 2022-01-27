import { PrimitiveTypes } from '../../src/interfaces/schema';
import SortUtils from '../../src/utils/sort';
import * as factories from '../__factories__';

describe('SortUtils', () => {
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
        SortUtils.validate(dataSource.getCollection('cars'), [{ field: 'id', ascending: true }]),
      ).not.toThrow();
    });

    test('should throw if the field does not exist on the collection', () => {
      expect(() =>
        SortUtils.validate(dataSource.getCollection('cars'), [
          { field: '__no__such__field', ascending: true },
        ]),
      ).toThrow();
    });

    test('should not throw if the ascending parameter is boolean', () => {
      expect(() =>
        SortUtils.validate(dataSource.getCollection('cars'), [{ field: 'id', ascending: true }]),
      ).not.toThrow();
    });

    test('should throw if the ascending parameter is not boolean', () => {
      expect(() =>
        SortUtils.validate(dataSource.getCollection('cars'), [
          { field: 'id', ascending: 42 as unknown as boolean },
        ]),
      ).toThrow();
    });
  });
});
