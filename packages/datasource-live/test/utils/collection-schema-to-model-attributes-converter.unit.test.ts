import { DataTypes } from 'sequelize';

import { LiveCollectionSchema } from '../../src/types';
import CollectionSchemaToModelAttributesConverter from '../../src/utils/collection-schema-to-model-attributes-converter';

describe('Utils > CollectionSchemaToModelAttributesConverter', () => {
  describe('convert', () => {
    describe('with Column fields', () => {
      const prepareSchema = (): LiveCollectionSchema => ({
        a: {
          columnType: 'Number',
          isPrimaryKey: true,
          type: 'Column',
        },
        b: {
          columnType: 'String',
          isPrimaryKey: false,
          type: 'Column',
        },
      });

      it('should convert all fields', () => {
        const schema: LiveCollectionSchema = prepareSchema();

        const attributes = CollectionSchemaToModelAttributesConverter.convert(schema);

        expect(Object.keys(attributes)).toBeArrayOfSize(Object.keys(schema).length);
      });

      it('should properly flag primary keys', () => {
        const schema: LiveCollectionSchema = prepareSchema();

        const attributes = CollectionSchemaToModelAttributesConverter.convert(schema);

        expect(attributes).toEqual(
          expect.objectContaining({
            a: expect.objectContaining({ primaryKey: true }),
            b: expect.objectContaining({ primaryKey: false }),
          }),
        );
      });

      it('should properly convert number primary keys to autoincrementing integer', () => {
        const schema: LiveCollectionSchema = prepareSchema();

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
        const schema: LiveCollectionSchema = {
          a: {
            foreignCollection: '__none__',
            foreignKey: '__none__',
            originKey: '__none__',
            foreignKeyTarget: '__none__',
            originKeyTarget: '__none__',
            throughCollection: '__none__',
            type: 'ManyToMany',
          },
        };

        const attributes = CollectionSchemaToModelAttributesConverter.convert(schema);

        expect(Object.keys(attributes)).toBeArrayOfSize(0);
      });
    });
  });
});
