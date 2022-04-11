import CollectionCustomizationContext from '../../context/collection-context';
import ConditionTree, {
  PlainConditionTree,
} from '../../interfaces/query/condition-tree/nodes/base';

export type OperatorReplacer = (
  value: unknown,
  context: CollectionCustomizationContext,
) => Promise<ConditionTree | PlainConditionTree> | ConditionTree | PlainConditionTree;
