import {
  CollectionSchema,
  FieldTypes,
  Operator,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';
import { DataTypes } from 'sequelize';

// eslint-disable-next-line max-len
import CollectionSchemaToModelAttributesConverter from '../../src/utils/collection-schema-to-model-attributes-converter';

describe('Utils > CollectionSchemaToModelAttributesConverter', () => {
  describe('convert', () => {
    describe('with Column fields', () => {
      const prepareSchema = (): CollectionSchema => ({
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
            isPrimaryKey: false,
            type: FieldTypes.Column,
          },
        },
        searchable: false,
        segments: [],
      });

      it('should convert all fields', () => {
        const schema: CollectionSchema = prepareSchema();

        const attributes = CollectionSchemaToModelAttributesConverter.convert(schema);

        expect(Object.keys(attributes)).toBeArrayOfSize(Object.keys(schema.fields).length);
      });

      it('should properly flag primary keys', () => {
        const schema: CollectionSchema = prepareSchema();

        const attributes = CollectionSchemaToModelAttributesConverter.convert(schema);

        expect(attributes).toEqual(
          expect.objectContaining({
            a: expect.objectContaining({ primaryKey: true }),
            b: expect.objectContaining({ primaryKey: false }),
          }),
        );
      });

      it('should properly convert number primary keys to autoincrementing integer', () => {
        const schema: CollectionSchema = prepareSchema();

        const attributes = CollectionSchemaToModelAttributesConverter.convert(schema);

        expect(attributes).toEqual(
          expect.objectContaining({
            a: expect.objectContaining({
              autoIncrement: true,
              primaryKey: true,
              type: DataTypes.INTEGER,
            }),
          }),
        );
      });
    });

    describe('with Relation fields', () => {
      it('should ignore all fields', () => {
        const schema: CollectionSchema = {
          actions: {},
          fields: {
            a: {
              foreignCollection: '__none__',
              foreignKey: '__none__',
              otherField: '__none__',
              throughCollection: '__none__',
              type: FieldTypes.ManyToMany,
              originRelation: '__key_NOT_USED__',
              targetRelation: '__key_NOT_USED__',
            },
          },
          searchable: false,
          segments: [],
        };

        const attributes = CollectionSchemaToModelAttributesConverter.convert(schema);

        expect(Object.keys(attributes)).toBeArrayOfSize(0);
      });
    });
  });
});
