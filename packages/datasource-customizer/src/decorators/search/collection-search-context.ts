import type { TCollectionName, TConditionTree, TFieldName, TSchema } from '../../templates';
import type { Caller, Collection } from '@forestadmin/datasource-toolkit';

import CollectionCustomizationContext from '../../context/collection-context';

export type SearchOptions<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = {
  /**
   * Include fields from the first level of relations
   */
  extended?: boolean;
  /**
   * Remove these fields from the default search fields
   */
  excludeFields?: Array<TFieldName<S, N>>;
  /**
   * Add these fields to the default search fields
   */
  includeFields?: Array<TFieldName<S, N>>;
  /**
   * Replace the list of default searched field by these fields
   */
  onlyFields?: Array<TFieldName<S, N>>;
};

export default class CollectionSearchContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends CollectionCustomizationContext<S, N> {
  constructor(
    collection: Collection,
    caller: Caller,
    public readonly generateSearchFilter: (
      searchText: string,
      options?: SearchOptions<S, N>,
    ) => TConditionTree<S, N>,
  ) {
    super(collection, caller);
  }
}
