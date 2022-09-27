import { TCollectionName, TConditionTree, TSchema } from '../../templates';
import CollectionCustomizationContext from '../../context/collection-context';

export type SegmentDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> =
  | ((
      context: CollectionCustomizationContext<S, N>,
    ) => Promise<TConditionTree<S, N>> | TConditionTree<S, N>)
  | TConditionTree<S, N>;
