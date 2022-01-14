import { Factory } from 'fishery';
import { ConditionTreeLeaf, Operator } from '../../../src/interfaces/query/selection';

export default Factory.define<ConditionTreeLeaf>(() => ({
  operator: Operator.Equal,
  field: 'a field',
  value: 'a value',
}));
