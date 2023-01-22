import { Aggregation } from '@forestadmin/datasource-toolkit';

import AggregationUtils from '../../src/utils/aggregation-converter';

describe('Utils > Aggregation', () => {
  describe('aggs', () => {
    it('should return aggregations', () => {
      const aggregation = new Aggregation({ operation: 'Sum', field: 'price' });

      expect(AggregationUtils.aggs(aggregation)).toStrictEqual({
        metricsAggregations: { sum: 'price' },
      });
    });
  });
});
