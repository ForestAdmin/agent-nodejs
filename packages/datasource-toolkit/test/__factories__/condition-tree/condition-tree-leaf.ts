import { Factory } from 'fishery';
import ConditionTreeLeaf, { Operator } from '../../../dist/interfaces/query/condition-tree/leaf';

export default Factory.define<ConditionTreeLeaf>(
  () =>
    new ConditionTreeLeaf({
      operator: Operator.Equal,
      field: 'a field',
      value: 'a value',
    }),
);
