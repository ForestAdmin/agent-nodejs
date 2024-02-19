import CollectionSearchContext from './collection-search-context';
import { TCollectionName, TConditionTree, TSchema } from '../../templates';

export type SearchDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = (
  value: string,
  extended: boolean,
  context: CollectionSearchContext<S, N>,
) => Promise<TConditionTree<S, N>> | TConditionTree<S, N>;
