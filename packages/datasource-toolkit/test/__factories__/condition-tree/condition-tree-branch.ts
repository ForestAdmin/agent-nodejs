import { Factory } from 'fishery';
import ConditionTreeBranch, {
  Aggregator,
} from '../../../dist/interfaces/query/condition-tree/branch';

export default Factory.define<ConditionTreeBranch>(
  () => new ConditionTreeBranch(Aggregator.And, []),
);
