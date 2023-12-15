import CollectionCustomizationContext from '../../context/collection-context';
import { TSchema, TCollectionName, TColumnName } from '../../templates';
import { Caller, Collection, ConditionTree } from '@forestadmin/datasource-toolkit';

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
  excludeFields?: Array<TColumnName<S, N>>;
  /**
   * Add these fields to the default search fields
   */
  includeFields?: Array<TColumnName<S, N>>;
  /**
   * Replace the list of default searched field by these fields
   */
  onlyFields?: Array<TColumnName<S, N>>;
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
    ) => ConditionTree,
  ) {
    super(collection, caller);
  }
}
