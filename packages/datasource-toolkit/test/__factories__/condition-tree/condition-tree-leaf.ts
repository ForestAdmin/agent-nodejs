import { Factory } from 'fishery';
import ConditionTreeLeaf, { Operator } from '../../../src/interfaces/query/condition-tree/leaf';

export default Factory.define<ConditionTreeLeaf>(
  () => new ConditionTreeLeaf('a field', Operator.Equal, 'a value'),
);
