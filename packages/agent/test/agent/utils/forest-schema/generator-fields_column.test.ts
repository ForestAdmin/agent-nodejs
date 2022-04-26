import { FieldTypes } from '@forestadmin/datasource-toolkit';

import * as factories from '../../__factories__';
import { ValidationType } from '../../../../src/agent/utils/forest-schema/types';
import SchemaGeneratorFields from '../../../../src/agent/utils/forest-schema/generator-fields';

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
            columnType: 'String',
            filterOperators: new Set([
              'Equal',
              'NotEqual',
              'Present',
              'Blank',
              'In',
              'StartsWith',
              'EndsWith',
              'Contains',
              'NotContains',
            ]),
            isPrimaryKey: true,
            isSortable: true,
            isReadOnly: true,
            validation: [{ operator: 'Present' }],
          }),
          originKey: factories.columnSchema.build({
            columnType: 'Number',
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
      const schema = SchemaGeneratorFields.buildSchema(collection, 'originKey');

      expect(schema).toMatchObject({
        field: 'originKey',
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
