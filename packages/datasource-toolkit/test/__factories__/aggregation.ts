import { Factory } from 'fishery';
import Aggregation, { AggregationOperation } from '../../dist/interfaces/query/aggregation';

export default Factory.define<Aggregation>(
  () =>
    new Aggregation({
      operation: AggregationOperation.Max,
    }),
);
