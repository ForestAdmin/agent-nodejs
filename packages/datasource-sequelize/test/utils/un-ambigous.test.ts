import { DataTypes, Sequelize } from 'sequelize';

import unAmbigousField from '../../src/utils/un-ambigous';

describe('Utils > unAmbigousField', () => {
  const setup = () => {
    const sequelize = new Sequelize({ dialect: 'postgres' });
    const model = sequelize.define('model', {
      aField: {
        field: '__a__field',
        type: DataTypes.STRING,
      },
    });

    return { sequelize, model };
  };

  describe('with a simple field', () => {
    it('should return the real field', () => {
      const { model } = setup();

      expect(unAmbigousField(model, 'aField')).toStrictEqual('__a__field');
    });

    it('should return unambigous field', () => {
      const { model } = setup();

      expect(unAmbigousField(model, 'aField', true)).toStrictEqual('model.__a__field');
    });

    describe('when mode does not have the field', () => {
      it('should an error', () => {
        const { model } = setup();

        expect(() => unAmbigousField(model, 'unknow')).toThrow();
      });
    });
  });

  describe('with a field on a relation', () => {
    const relationSetup = () => {
      const { sequelize, model } = setup();

      const relation = sequelize.define('relation', {
        relationField: {
          field: '__relation__field',
          type: DataTypes.STRING,
        },
      });
      model.hasMany(relation);

      const nestedRelation = sequelize.define('nestedRelation', {
        nestedRelationField: {
          field: '__nested__relation__field',
          type: DataTypes.STRING,
        },
      });
      relation.belongsTo(nestedRelation);

      return { sequelize, model, relation };
    };

    it('should return unambigous field', () => {
      const { model } = relationSetup();

      expect(unAmbigousField(model, 'relations:relationField')).toStrictEqual(
        'relations.__relation__field',
      );
    });

    describe('whith nested relation', () => {
      it('should return unambigous field', () => {
        const { model } = relationSetup();

        expect(
          unAmbigousField(model, 'relations:nestedRelation:nestedRelationField'),
        ).toStrictEqual('relations.nestedRelation.__nested__relation__field');
      });
    });

    describe('when mode does not have the field', () => {
      it('should an error', () => {
        const { model } = relationSetup();

        expect(() => unAmbigousField(model, 'relations:unknow')).toThrow();
      });
    });

    describe('when model does not have the relation', () => {
      it('should an error', () => {
        const { model } = relationSetup();

        expect(() => unAmbigousField(model, 'unknow:unknow')).toThrow();
      });
    });
  });
});
