import { Factory } from 'fishery';
import Aggregation from '../../src/interfaces/query/aggregation';

export default Factory.define<Aggregation>(() => new Aggregation({ operation: 'Max' }));
