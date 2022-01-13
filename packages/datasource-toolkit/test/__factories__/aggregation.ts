import { Factory } from 'fishery';
import { Aggregation, AggregationOperation } from '../../src/interfaces/query/aggregation';

export default Factory.define<Aggregation>(() => ({
  operation: AggregationOperation.Max,
}));
