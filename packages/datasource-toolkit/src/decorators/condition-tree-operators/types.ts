import { ConditionTree, ConditionTreeLeaf, Operator } from '../../interfaces/query/selection';
import { PrimitiveTypes } from '../../interfaces/schema';

export type Alternative = {
  dependsOn: Operator[];
  replacer: Replacer;
  forTypes?: PrimitiveTypes[];
};

export type Replacer = (leaf: ConditionTreeLeaf, timezone: string) => ConditionTree;
