import { PlainConditionTree } from '../../interfaces/query/condition-tree/nodes/base';
import CollectionCustomizationContext from '../../context/collection-context';

export type OperatorReplacer = (
  value: unknown,
  context: CollectionCustomizationContext,
) => Promise<PlainConditionTree> | PlainConditionTree;
