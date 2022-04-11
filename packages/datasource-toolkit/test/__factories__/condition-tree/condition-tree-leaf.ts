import { Factory } from 'fishery';
import ConditionTreeLeaf from '../../../src/interfaces/query/condition-tree/nodes/leaf';

export default Factory.define<ConditionTreeLeaf>(
  () => new ConditionTreeLeaf('a field', 'Equal', 'a value'),
);
