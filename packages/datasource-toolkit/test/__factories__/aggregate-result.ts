import { Factory } from 'fishery';

import { AggregateResult } from '../../src/interfaces/query/aggregation';

export default Factory.define<AggregateResult>(() => ({
  value: 10,
  group: {
    field: 'result',
  },
}));
