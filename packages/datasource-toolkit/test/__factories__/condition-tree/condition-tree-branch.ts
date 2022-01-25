import { Factory } from 'fishery';
import { Aggregator, ConditionTreeBranch } from '../../../src/interfaces/query/selection';

export default Factory.define<ConditionTreeBranch>(() => ({
  aggregator: Aggregator.And,
  conditions: [],
}));
