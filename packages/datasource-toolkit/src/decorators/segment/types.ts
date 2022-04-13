import CollectionCustomizationContext from '../../context/collection-context';
import ConditionTree, {
  PlainConditionTree,
} from '../../interfaces/query/condition-tree/nodes/base';

export type SegmentDefinition =
  | ((
      context: CollectionCustomizationContext,
    ) => Promise<ConditionTree | PlainConditionTree> | ConditionTree | PlainConditionTree)
  | Promise<ConditionTree | PlainConditionTree>
  | ConditionTree
  | PlainConditionTree;
