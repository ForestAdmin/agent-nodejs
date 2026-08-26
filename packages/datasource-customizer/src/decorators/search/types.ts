import type CollectionSearchContext from './collection-search-context';
import type { SearchOptions } from './collection-search-context';
import type { TCollectionName, TConditionTree, TSchema } from '../../templates';

export type SearchHandlerDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = (
  value: string,
  extended: boolean,
  context: CollectionSearchContext<S, N>,
) => Promise<TConditionTree<S, N>> | TConditionTree<S, N>;

/** `extended` is omitted on purpose: that flag is the caller's, and comes from the request. */
export type SearchFieldsDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = Omit<SearchOptions<S, N>, 'extended'>;

export type SearchDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = SearchHandlerDefinition<S, N> | SearchFieldsDefinition<S, N>;
