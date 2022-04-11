import { Factory } from 'fishery';
import ConditionTreeBranch from '../../../src/interfaces/query/condition-tree/nodes/branch';

export default Factory.define<ConditionTreeBranch>(() => new ConditionTreeBranch('And', []));
