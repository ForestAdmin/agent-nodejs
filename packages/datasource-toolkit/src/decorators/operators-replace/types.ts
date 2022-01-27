import ConditionTree from '../../interfaces/query/condition-tree/base';
import ConditionTreeLeaf, { Operator } from '../../interfaces/query/condition-tree/leaf';
import { PrimitiveTypes } from '../../interfaces/schema';

export type Alternative = {
  dependsOn: Operator[];
  replacer: Replacer;
  forTypes?: PrimitiveTypes[];
};

export type Replacer = (leaf: ConditionTreeLeaf, timezone: string) => ConditionTree;
