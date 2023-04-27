import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import AggregationUtils from '../../src/utils/aggregation-converter';

describe('Utils > Aggregation', () => {
  describe('aggs', () => {
    it('should return aggregations', () => {
      const aggregation = factories.aggregation.build({ operation: 'Sum', field: 'price' });
      const filter = factories.filter.build();

      expect(AggregationUtils.aggs(aggregation, filter)).toStrictEqual({
        metricsAggregations: { sum: { field: 'price' } },
      });
    });

    // TODO define all aggregations
  });
});
