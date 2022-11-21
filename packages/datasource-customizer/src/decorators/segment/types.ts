import CollectionCustomizationContext from '../../context/collection-context';
import { TCollectionName, TConditionTree, TSchema } from '../../templates';

export type SegmentDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> =
  | ((
      context: CollectionCustomizationContext<S, N>,
    ) => Promise<TConditionTree<S, N>> | TConditionTree<S, N>)
  | TConditionTree<S, N>;
