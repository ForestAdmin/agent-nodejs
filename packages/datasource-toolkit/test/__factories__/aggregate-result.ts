import type { AggregateResult } from '../../src/interfaces/query/aggregation';

import { Factory } from 'fishery';

export default Factory.define<AggregateResult>(() => ({
  value: 10,
  group: {
    field: 'result',
  },
}));
