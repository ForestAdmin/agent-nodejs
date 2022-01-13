import { Factory } from 'fishery';
import { Aggregation, AggregationOperation } from '../../src';

export default Factory.define<Aggregation>(() => ({
  operation: AggregationOperation.Max,
}));
