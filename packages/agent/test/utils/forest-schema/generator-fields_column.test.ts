import { FieldTypes, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import SchemaGeneratorFields from '../../../src/utils/forest-schema/generator-fields';
import { ValidationType } from '../../../src/utils/forest-schema/types';
import * as factories from '../../__factories__';

describe('SchemaGeneratorFields > Column', () => {
  describe('invalid schema', () => {
    const collection = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          isbn: {
            type: 'InvalidType' as unknown as FieldTypes,
          },
        },
      }),
    });

    test('should throw if an invalid field is passed', () => {
      const fn = () => SchemaGeneratorFields.buildSchema(collection, 'isbn');
      expect(fn).toThrow('Invalid field type');
    });
  });

  describe('required/filterable/readonly/pk/sortable', () => {
    const collection = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          isbn: factories.columnSchema.build({
            columnType: PrimitiveTypes.String,
            isPrimaryKey: true,
            isSortable: true,
            isReadOnly: true,
            filterOperators: new Set(Object.values(Operator)),
            validation: [{ operator: Operator.Present }],
          }),
          otherField: factories.columnSchema.build({
            columnType: PrimitiveTypes.Number,
            filterOperators: new Set(),
            isPrimaryKey: false,
            isReadOnly: false,
            isSortable: false,
            validation: null,
          }),
        },
      }),
    });

    test('is should generate the proper schema for the isbn field', () => {
      const schema = SchemaGeneratorFields.buildSchema(collection, 'isbn');

      expect(schema).toMatchObject({
        field: 'isbn',
        isFilterable: true,
        isPrimaryKey: true,
        isReadOnly: true,
        isRequired: true,
        isSortable: true,
        validations: [{ message: null, type: ValidationType.Present }],
        type: 'String',
      });
    });

    test('is should generate the proper schema for the other field', () => {
      const schema = SchemaGeneratorFields.buildSchema(collection, 'otherField');

      expect(schema).toMatchObject({
        field: 'otherField',
        isFilterable: false,
        isPrimaryKey: false,
        isReadOnly: false,
        isRequired: false,
        isSortable: false,
        validations: [],
        type: 'Number',
      });
    });
  });
});
