import { PrimitiveTypes } from '../../dist/interfaces/schema';
import * as factories from '../__factories__';
import FieldValidator from '../../dist/validation/field';

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

  describe('validateValue', () => {
    describe('on field of type boolean', () => {
      test('valid value type should not throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'boolean',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Boolean,
            }),
            true,
          ),
        ).not.toThrow();
      });

      test('invalid value type should throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'boolean',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Boolean,
            }),
            'not a boolean',
          ),
        ).toThrow('Wrong type for "boolean": not a boolean. Expects Boolean');
      });
    });

    describe('on field of type string', () => {
      test('valid value type should not throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'string',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.String,
            }),
            'test',
          ),
        ).not.toThrow();
      });

      test('invalid value type should throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'string',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.String,
            }),
            1,
          ),
        ).toThrow('Wrong type for "string": 1. Expects String');
      });
    });

    describe('on field of type number', () => {
      test('valid value type should not throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'number',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Number,
            }),
            1,
          ),
        ).not.toThrow();
      });

      test('invalid value type should throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'number',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Number,
            }),
            '1',
          ),
        ).toThrow('Wrong type for "number": 1. Expects Number');
      });
    });

    describe('on field of type date|dateonly|timeonly', () => {
      test('valid value (string) type should not throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'date',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Date,
            }),
            '2022-01-13T17:16:04.000Z',
          ),
        ).not.toThrow();
      });

      test('valid value (js date) type should not throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'date',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Date,
            }),
            new Date('2022-01-13T17:16:04.000Z'),
          ),
        ).not.toThrow();
      });

      test('invalid value type should throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'date',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Date,
            }),
            'definitely-not-a-date',
          ),
        ).toThrow('Wrong type for "date": definitely-not-a-date. Expects Date');
      });
    });

    describe('on field of type enum', () => {
      test('valid value type should not throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'enum',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Enum,
              enumValues: ['a', 'b', 'c'],
            }),
            'a',
          ),
        ).not.toThrow();
      });

      test('invalid value type should throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'enum',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Enum,
              enumValues: ['a', 'b', 'c'],
            }),
            'd',
          ),
        ).toThrow('The given enum value(s) [d] is not listed in [a,b,c]');
      });
    });

    describe('on field of type json', () => {
      test('valid (string) value type should not throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'json',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Json,
            }),
            '{"foo": "bar"}',
          ),
        ).not.toThrow();
      });

      test('valid (json) value type should not throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'json',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Json,
            }),
            { foo: 'bar' },
          ),
        ).not.toThrow();
      });

      test('invalid value type should throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'json',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Json,
            }),
            '{not:"a:" valid json',
          ),
        ).toThrow('Wrong type for "json": {not:"a:" valid json. Expects Json');
      });
    });

    describe('on field of type uuid', () => {
      test('valid value (uuid v1) type should not throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'uuid',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Uuid,
            }),
            'a7147d1c-7d44-11ec-90d6-0242ac120003',
          ),
        ).not.toThrow();
      });

      test('valid value (uuid v4) type should not throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'uuid',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Uuid,
            }),
            '05db90e8-6e72-4278-888d-9b127c91470e',
          ),
        ).not.toThrow();
      });

      test('invalid value type should throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'uuid',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Uuid,
            }),
            'not-a-valid-uuid',
          ),
        ).toThrow('Wrong type for "uuid": not-a-valid-uuid. Expects Uuid');
      });
    });

    describe('on field of type point', () => {
      test('valid value type should not throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'point',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Point,
            }),
            '1,2',
          ),
        ).not.toThrow();
      });

      test('invalid value type should throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'point',
            factories.columnSchema.build({
              columnType: PrimitiveTypes.Point,
            }),
            'd,a',
          ),
        ).toThrow('Wrong type for "point": d,a. Expects Point');
      });
    });

    describe('on field of incorrect primitive type', () => {
      test('invalid value type should throw error', () => {
        expect(() =>
          FieldValidator.validateValue(
            'something-else',
            factories.columnSchema.build({
              columnType: 'SomethingNotPrimitive' as unknown as PrimitiveTypes,
            }),
            'something',
          ),
        ).toThrow('Unexpected schema type: SomethingNotPrimitive');
      });
    });
  });
});
