import { PrimitiveTypes } from '../../dist/interfaces/schema';
import FieldValidator from '../../dist/validation/field';
import * as factories from '../__factories__';

describe('FieldValidator', () => {
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
            name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
            address: factories.oneToOneSchema.build({}),
          },
        }),
      }),
    ]);

    test('should not throw if the field exist on the collection', () => {
      expect(() => FieldValidator.validate(dataSource.getCollection('cars'), 'id')).not.toThrow();
    });

    test('should throw if the field does not exists', () => {
      expect(() =>
        FieldValidator.validate(dataSource.getCollection('cars'), '__not_defined'),
      ).toThrow("Column not found: 'cars.__not_defined'");
    });

    test('should throw if the relation does not exists', () => {
      expect(() =>
        FieldValidator.validate(dataSource.getCollection('cars'), '__not_defined:id'),
      ).toThrow("Relation not found: 'cars.__not_defined'");
    });

    test('should throw if the field is not of column type', () => {
      expect(() => FieldValidator.validate(dataSource.getCollection('cars'), 'owner')).toThrow(
        "Unexpected field type: 'cars.owner' (found 'OneToOne' expected 'Column')",
      );
    });

    test('should throw un-implemented error when using the values argument', () => {
      expect(() => FieldValidator.validate(dataSource.getCollection('cars'), 'id', [123])).toThrow(
        'Implement me.',
      );
    });

    describe('when validating relationship fields', () => {
      test('should validate fields on other collections', () => {
        expect(() =>
          FieldValidator.validate(dataSource.getCollection('cars'), 'owner:name'),
        ).not.toThrow();
      });

      test('should throw when the requested field is of type column', () => {
        expect(() =>
          FieldValidator.validate(dataSource.getCollection('cars'), 'id:address'),
        ).toThrow(
          "Unexpected field type: 'cars.id' (found 'Column' expected 'ManyToOne' or 'OneToOne')",
        );
      });
    });
  });
});
