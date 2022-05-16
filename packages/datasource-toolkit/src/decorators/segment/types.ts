import { PlainConditionTree } from '../../interfaces/query/condition-tree/nodes/base';
import { TCollectionName, TSchema } from '../../interfaces/templates';
import CollectionCustomizationContext from '../../context/collection-context';

export type SegmentDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> =
  | ((
      context: CollectionCustomizationContext<S, N>,
    ) => Promise<PlainConditionTree<S, N>> | PlainConditionTree<S, N>)
  | PlainConditionTree<S, N>;
