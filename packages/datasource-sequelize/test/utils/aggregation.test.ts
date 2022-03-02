import { Sequelize } from 'sequelize';

import AggregationUtils from '../../src/utils/aggregation';

describe('Utils > AggregationUtils', () => {
  describe('unAmbigousField', () => {
    const setup = () => {
      const sequelize = new Sequelize({ dialect: 'postgres' });
      const model = sequelize.define('model', {});

      return { sequelize, model };
    };

    describe('with a simple field', () => {
      it('should return quoted unambigous field', () => {
        const { model } = setup();
        const aggregationUtils = new AggregationUtils(model);

        expect(aggregationUtils.unAmbigousField('id')).toStrictEqual('"model"."id"');
      });

      describe('when mode does not have the field', () => {
        it('should an error', () => {
          const { model } = setup();
          const aggregationUtils = new AggregationUtils(model);

          expect(() => aggregationUtils.unAmbigousField('unknow')).toThrowError(
            'model model does not have field "unknow".',
          );
        });
      });
    });

    describe('with a field on a relation', () => {
      const relationSetup = () => {
        const { sequelize, model } = setup();

        const relation = sequelize.define('relation', {});
        model.hasMany(relation);

        return { sequelize, model, relation };
      };

      it('should return quoted unambigous field', () => {
        const { model } = relationSetup();
        const aggregationUtils = new AggregationUtils(model);

        expect(aggregationUtils.unAmbigousField('relations:id')).toStrictEqual('"relations"."id"');
      });

      describe('when mode does not have the field', () => {
        it('should an error', () => {
          const { model } = relationSetup();
          const aggregationUtils = new AggregationUtils(model);

          expect(() => aggregationUtils.unAmbigousField('relations:unknow')).toThrowError(
            'relations model does not have field "unknow".',
          );
        });
      });

      describe('when model does not have the relation', () => {
        it('should an error', () => {
          const { model } = relationSetup();
          const aggregationUtils = new AggregationUtils(model);

          expect(() => aggregationUtils.unAmbigousField('unknow:unknow')).toThrowError(
            'model does not have association "unknow".',
          );
        });
      });
    });
  });
});
