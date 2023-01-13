import { DataTypes, Sequelize } from 'sequelize';

import AggregationUtils from '../../src/utils/aggregation';

describe('Utils > Aggregation', () => {
  describe('quoteField', () => {
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

    it('should return quoted unambigous field', () => {
      const { model } = setup();
      const aggregationUtils = new AggregationUtils(model);

      expect(aggregationUtils.quoteField('aField')).toStrictEqual('"model"."__a__field"');
    });

    it('should throw an error', () => {
      const { model } = setup();
      const aggregationUtils = new AggregationUtils(model);

      expect(() => aggregationUtils.quoteField('unknown')).toThrow(
        'Invalid access: "unknown" on "model" does not exist.',
      );
    });
  });
});
