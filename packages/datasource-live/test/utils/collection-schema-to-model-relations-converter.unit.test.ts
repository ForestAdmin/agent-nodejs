import { Sequelize } from 'sequelize';

import { LiveCollectionSchema } from '../../src/types';
import CollectionSchemaToModelRelationsConverter from '../../src/utils/collection-schema-to-model-relations-converter';

describe('Utils > CollectionSchemaToModelRelationsConverter', () => {
  describe('convert', () => {
    describe('with Column fields', () => {
      it('should ignore all fields', () => {
        const schema: LiveCollectionSchema = {
          a: {
            columnType: 'Number',
            isPrimaryKey: true,
            type: 'Column',
          },
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
      const prepareSchema = (): LiveCollectionSchema => {
        return {};
      };

      const setup = () => {
        const schema: LiveCollectionSchema = prepareSchema();
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

          schema.a = {
            foreignCollection: '__collection__',
            foreignKey: '__fk__',
            originKey: '__origin__',
            foreignKeyTarget: '__fk_target__',
            originKeyTarget: '__origin_target__',
            throughCollection: '__through_collection__',
            type: 'ManyToMany',
          };

          const relations = CollectionSchemaToModelRelationsConverter.convert(
            '__name__',
            schema,
            sequelize,
          );

          expect(relations).toBeArrayOfSize(1);
          expect(relations[0]).toBe(belongsToManyRelation);
          expect(sequelize.model).toHaveBeenCalledTimes(2);
          expect(belongsToMany).toHaveBeenCalledTimes(1);
          expect(belongsToMany).toHaveBeenNthCalledWith(1, model, {
            as: 'a',
            through: '__through_collection__',
            foreignKey: '__origin__',
            targetKey: '__origin_target__',
            otherKey: '__fk__',
            sourceKey: '__fk_target__',
          });
        });
      });

      describe('with ManyToOne fields', () => {
        it('should generate a reference', () => {
          const { belongsTo, belongsToRelation, model, schema, sequelize } = setup();

          schema.a = {
            foreignCollection: '__collection__',
            foreignKey: '__key__',
            foreignKeyTarget: '__target__',
            type: 'ManyToOne',
          };

          const relations = CollectionSchemaToModelRelationsConverter.convert(
            '__name__',
            schema,
            sequelize,
          );

          expect(relations).toBeArrayOfSize(1);
          expect(relations[0]).toBe(belongsToRelation);
          expect(sequelize.model).toHaveBeenCalledTimes(2);
          expect(belongsTo).toHaveBeenCalledTimes(1);
          expect(belongsTo).toHaveBeenCalledWith(model, {
            as: 'a',
            foreignKey: schema.a.foreignKey,
            targetKey: schema.a.foreignKeyTarget,
          });
        });
      });

      describe('with OneToMany fields', () => {
        it('should generate a reference', () => {
          const { hasMany, hasManyRelation, model, schema, sequelize } = setup();

          schema.a = {
            foreignCollection: '__collection__',
            originKey: '__key__',
            originKeyTarget: '__target__',

            type: 'OneToMany',
          };

          const relations = CollectionSchemaToModelRelationsConverter.convert(
            '__name__',
            schema,
            sequelize,
          );

          expect(relations).toBeArrayOfSize(1);
          expect(relations[0]).toBe(hasManyRelation);
          expect(sequelize.model).toHaveBeenCalledTimes(2);
          expect(hasMany).toHaveBeenCalledTimes(1);
          expect(hasMany).toHaveBeenCalledWith(model, {
            as: 'a',
            foreignKey: '__key__',
            sourceKey: '__target__',
          });
        });
      });

      describe('with OneToOne fields', () => {
        it('should generate a reference', () => {
          const { hasOne, hasOneRelation, model, schema, sequelize } = setup();

          schema.a = {
            foreignCollection: '__collection__',
            originKey: '__key__',
            originKeyTarget: '__target__',
            type: 'OneToOne',
          };

          const relations = CollectionSchemaToModelRelationsConverter.convert(
            '__name__',
            schema,
            sequelize,
          );

          expect(relations).toBeArrayOfSize(1);
          expect(relations[0]).toBe(hasOneRelation);
          expect(sequelize.model).toHaveBeenCalledTimes(2);
          expect(hasOne).toHaveBeenCalledTimes(1);
          expect(hasOne).toHaveBeenCalledWith(model, {
            as: 'a',
            foreignKey: '__key__',
            sourceKey: '__target__',
          });
        });
      });
    });
  });
});
