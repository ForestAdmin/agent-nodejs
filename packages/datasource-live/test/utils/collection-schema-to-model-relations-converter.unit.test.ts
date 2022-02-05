import { Sequelize } from 'sequelize';

import {
  CollectionSchema,
  FieldTypes,
  Operator,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';

// eslint-disable-next-line max-len
import CollectionSchemaToModelRelationsConverter from '../../src/utils/collection-schema-to-model-relations-converter';

describe('Utils > CollectionSchemaToModelRelationsConverter', () => {
  describe('convert', () => {
    describe('with Column fields', () => {
      it('should ignore all fields', () => {
        const schema: CollectionSchema = {
          actions: {},
          fields: {
            a: {
              columnType: PrimitiveTypes.Number,
              filterOperators: new Set<Operator>(),
              isPrimaryKey: true,
              type: FieldTypes.Column,
            },
          },
          searchable: false,
          segments: [],
        };
        const sequelize: Sequelize = {
          model: jest.fn(),
        } as unknown as Sequelize;

        const relations = CollectionSchemaToModelRelationsConverter.convert(
          '__name__',
          schema,
          sequelize,
        );

        expect(Object.keys(relations)).toBeArrayOfSize(0);
        expect(sequelize.model).toHaveBeenCalledTimes(1);
      });
    });

    describe('with Relation fields', () => {
      const prepareSchema = (): CollectionSchema => {
        return {
          actions: {},
          fields: {},
          searchable: false,
          segments: [],
        };
      };

      const setup = () => {
        const schema: CollectionSchema = prepareSchema();
        const belongsToManyRelation = Symbol('belongsToManyRelation');
        const belongsToRelation = Symbol('belongsToRelation');
        const hasManyRelation = Symbol('hasManyRelation');
        const hasOneRelation = Symbol('hasOneRelation');
        const belongsTo = jest.fn(() => belongsToRelation);
        const belongsToMany = jest.fn(() => belongsToManyRelation);
        const hasMany = jest.fn(() => hasManyRelation);
        const hasOne = jest.fn(() => hasOneRelation);
        const model = { belongsTo, belongsToMany, hasMany, hasOne };
        const sequelize = {
          model: jest.fn(() => model),
        } as unknown as Sequelize;

        return {
          belongsTo,
          belongsToMany,
          belongsToManyRelation,
          belongsToRelation,
          hasMany,
          hasManyRelation,
          hasOne,
          hasOneRelation,
          model,
          schema,
          sequelize,
        };
      };

      describe('with ManyToMany fields', () => {
        it('should generate a reference', () => {
          const { belongsToMany, belongsToManyRelation, model, schema, sequelize } = setup();

          schema.fields.a = {
            foreignCollection: '__collection__',
            foreignKey: '__key__',
            otherField: '__other_field__',
            throughCollection: '__through__collection__',
            type: FieldTypes.ManyToMany,
          };

          const relations = CollectionSchemaToModelRelationsConverter.convert(
            '__name__',
            schema,
            sequelize,
          );

          expect(relations).toBeArrayOfSize(2);
          expect(relations[0]).toBe(belongsToManyRelation);
          expect(relations[1]).toBe(belongsToManyRelation);
          expect(sequelize.model).toHaveBeenCalledTimes(2);
          expect(belongsToMany).toHaveBeenCalledTimes(2);
          expect(belongsToMany).toHaveBeenNthCalledWith(1, model, {
            otherKey: schema.fields.a.otherField,
            through: schema.fields.a.throughCollection,
          });
          expect(belongsToMany).toHaveBeenNthCalledWith(2, model, {
            foreignKey: schema.fields.a.foreignKey,
            through: schema.fields.a.throughCollection,
          });
        });
      });

      describe('with ManyToOne fields', () => {
        it('should generate a reference', () => {
          const { belongsTo, belongsToRelation, hasOne, hasOneRelation, model, schema, sequelize } =
            setup();

          schema.fields.a = {
            foreignCollection: '__collection__',
            foreignKey: '__key__',
            type: FieldTypes.ManyToOne,
          };

          const relations = CollectionSchemaToModelRelationsConverter.convert(
            '__name__',
            schema,
            sequelize,
          );

          expect(relations).toBeArrayOfSize(2);
          expect(relations[0]).toBe(belongsToRelation);
          expect(relations[1]).toBe(hasOneRelation);
          expect(sequelize.model).toHaveBeenCalledTimes(2);
          expect(belongsTo).toHaveBeenCalledTimes(1);
          expect(belongsTo).toHaveBeenCalledWith(model, { targetKey: schema.fields.a.foreignKey });
          expect(hasOne).toHaveBeenCalledTimes(1);
          expect(hasOne).toHaveBeenCalledWith(model);
        });
      });

      describe('with OneToMany fields', () => {
        it('should generate a reference', () => {
          const {
            belongsTo,
            belongsToRelation,
            hasMany,
            hasManyRelation,
            model,
            schema,
            sequelize,
          } = setup();

          schema.fields.a = {
            foreignCollection: '__collection__',
            foreignKey: '__key__',
            type: FieldTypes.OneToMany,
          };

          const relations = CollectionSchemaToModelRelationsConverter.convert(
            '__name__',
            schema,
            sequelize,
          );

          expect(relations).toBeArrayOfSize(2);
          expect(relations[0]).toBe(hasManyRelation);
          expect(relations[1]).toBe(belongsToRelation);
          expect(sequelize.model).toHaveBeenCalledTimes(2);
          expect(belongsTo).toHaveBeenCalledTimes(1);
          expect(belongsTo).toHaveBeenCalledWith(model);
          expect(hasMany).toHaveBeenCalledTimes(1);
          expect(hasMany).toHaveBeenCalledWith(model, { foreignKey: schema.fields.a.foreignKey });
        });
      });

      describe('with OneToOne fields', () => {
        it('should generate a reference', () => {
          const { belongsTo, belongsToRelation, hasOne, hasOneRelation, model, schema, sequelize } =
            setup();

          schema.fields.a = {
            foreignCollection: '__collection__',
            foreignKey: '__key__',
            type: FieldTypes.OneToOne,
          };

          const relations = CollectionSchemaToModelRelationsConverter.convert(
            '__name__',
            schema,
            sequelize,
          );

          expect(relations).toBeArrayOfSize(2);
          expect(relations[0]).toBe(hasOneRelation);
          expect(relations[1]).toBe(belongsToRelation);
          expect(sequelize.model).toHaveBeenCalledTimes(2);
          expect(belongsTo).toHaveBeenCalledTimes(1);
          expect(belongsTo).toHaveBeenCalledWith(model);
          expect(hasOne).toHaveBeenCalledTimes(1);
          expect(hasOne).toHaveBeenCalledWith(model, { foreignKey: schema.fields.a.foreignKey });
        });
      });
    });
  });
});
