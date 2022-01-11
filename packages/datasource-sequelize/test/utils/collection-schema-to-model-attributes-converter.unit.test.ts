import {
  CollectionSchema,
  FieldTypes,
  Operator,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';
// eslint-disable-next-line max-len
import CollectionSchemaToModelAttributesConverter from '../../src/utils/collection-schema-to-model-attributes-converter';

describe('Utils > CollectionSchemaToModelAttributesConverter', () => {
  describe('convert', () => {
    describe('with Column fields', () => {
      it('should convert all fields', () => {
        const schema: CollectionSchema = {
          actions: {},
          fields: {
            a: {
              columnType: PrimitiveTypes.Number,
              filterOperators: new Set<Operator>(),
              isPrimaryKey: true,
              type: FieldTypes.Column,
            },
            b: {
              columnType: PrimitiveTypes.String,
              filterOperators: new Set<Operator>(),
              isPrimaryKey: true,
              type: FieldTypes.Column,
            },
          },
          searchable: false,
          segments: [],
        };

        const attributes = CollectionSchemaToModelAttributesConverter.convert(schema);

        expect(Object.keys(attributes)).toBeArrayOfSize(Object.keys(schema.fields).length);
      });

      it.todo('should properly flag primary keys');

      it.todo('should properly flag number primary keys as autoincrement');
    });

    describe('with Relation fields', () => {
      it('should fail', () => {
        const schema: CollectionSchema = {
          actions: {},
          fields: {
            a: {
              foreignCollection: '__none__',
              foreignKey: '__none__',
              type: FieldTypes.OneToOne,
            },
          },
          searchable: false,
          segments: [],
        };

        expect(() => CollectionSchemaToModelAttributesConverter.convert(schema)).toThrow(
          'Unsupported field type: "OneToOne".',
        );
      });
    });
  });
});
