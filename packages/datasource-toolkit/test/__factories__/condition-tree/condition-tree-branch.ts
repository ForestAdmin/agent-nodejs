import { Factory } from 'fishery';
import ConditionTreeBranch, {
  Aggregator,
} from '../../../src/interfaces/query/condition-tree/nodes/branch';

export default Factory.define<ConditionTreeBranch>(
  () => new ConditionTreeBranch(Aggregator.And, []),
);
