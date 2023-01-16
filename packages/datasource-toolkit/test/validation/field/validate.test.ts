import FieldValidator from '../../../src/validation/field';
import * as factories from '../../__factories__';

describe('FieldValidator', () => {
  describe('validate', () => {
    const carsCollection = factories.collection.build({
      name: 'cars',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          owner: factories.oneToOneSchema.build({
            foreignCollection: 'owner',
            originKey: 'id',
          }),
        },
      }),
    });

    test('should not throw if the field exist on the collection', () => {
      expect(() => FieldValidator.validate(carsCollection, 'id')).not.toThrow();
    });

    test('should not throw if the given value is null', () => {
      expect(() => FieldValidator.validate(carsCollection, 'id', [null])).not.toThrow();
    });

    test('should not throw if the given value is allowed', () => {
      expect(() =>
        FieldValidator.validate(carsCollection, 'id', ['11111111-772d-48a8-871e-114a64251189']),
      ).not.toThrow();
    });

    test('should throw if the field does not exists', () => {
      expect(() => FieldValidator.validate(carsCollection, '__not_defined')).toThrow(
        "Column not found: 'cars.__not_defined'",
      );
    });

    test('should throw if the relation does not exists', () => {
      expect(() => FieldValidator.validate(carsCollection, '__not_defined:id')).toThrow(
        "Relation not found: 'cars.__not_defined'",
      );
    });

    test('should throw if the field is not of column type', () => {
      expect(() => FieldValidator.validate(carsCollection, 'owner')).toThrow(
        "Unexpected field type: 'cars.owner' (found 'OneToOne' expected 'Column')",
      );
    });

    describe('when validating relationship fields', () => {
      test('should validate fields on other collections', () => {
        const dataSource = factories.dataSource.buildWithCollections([
          carsCollection,
          factories.collection.build({
            name: 'owner',
            schema: factories.collectionSchema.build({
              fields: {
                id: factories.columnSchema.uuidPrimaryKey().build(),
                name: factories.columnSchema.build({ columnType: 'String' }),
                address: factories.oneToOneSchema.build({}),
              },
            }),
          }),
        ]);

        expect(() =>
          FieldValidator.validate(dataSource.getCollection('cars'), 'owner:name'),
        ).not.toThrow();
      });

      test('should throw when the requested field is of type column', () => {
        expect(() => FieldValidator.validate(carsCollection, 'id:address')).toThrow(
          "Unexpected field type: 'cars.id' (found 'Column' expected 'ManyToOne' or 'OneToOne')",
        );
      });
    });

    describe('when validating a json field with an array value', () => {
      test('should allow the array as a value', () => {
        const dataSource = factories.dataSource.buildWithCollection(
          factories.collection.build({
            name: 'owner',
            schema: factories.collectionSchema.build({
              fields: {
                jsonField: factories.columnSchema.build({
                  columnType: 'Json',
                  filterOperators: new Set(['In']),
                }),
              },
            }),
          }),
        );

        expect(() =>
          FieldValidator.validate(dataSource.getCollection('owner'), 'jsonField', [
            ['item1', 'item2'],
          ]),
        ).not.toThrow();
      });
    });
  });
});
