import { Action } from "./action";
import { AggregateResult, Aggregation } from "./query/aggregation";
import { Projection } from "./query/projection";
import { CompositeId, RecordData } from "./query/record";
import { PaginatedFilter, Filter } from "./query/selection";
import { CollectionSchema } from "./schema";

/**
 * Represent a datasource
 *
 * A datasource is a list of collections from a single source of data
 */
export interface DataSource {
  /** List of collections associated with the datasource */
  get collections(): Collection[];

  /**
   * Get a collection by name from the datasource
   * @params name The name of the collection
   * @return The collection when found
   */
  getCollection(name: string): Collection;
}

/**
 * Represent a collection
 */
export interface Collection {
  /** The datasource the collection is associated with */
  get dataSource(): DataSource;
  /** Name of the collection */
  get name(): string;
  /** Schema of the collection */
  get schema(): CollectionSchema;

  /**
   * Get an action by name
   *
   * @params name The name of the action to retrieve
   * @return The action when it exists
   */
  getAction(name: string): Action;

  /**
   * Get record data by id
   *
   * @params id The requested record id
   * @params projection The requested record projection
   * @return An promise of a record data
   */
  getById(id: CompositeId, projection: Projection): Promise<RecordData>;

  /**
   * Create a list of records
   *
   * @params data An array of records data to create
   * @return An promise containing the created record
   */
  create(data: RecordData[]): Promise<RecordData[]>;

  /**
   * List records based on specific list of filters
   *
   * @params filter A filter representing a selection of records to return
   * @params projection The requested record projection
   * @return An promise containing a list of records matching the parameters provided
   */
  list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]>;

  /**
   * Update a list of records
   *
   * @params filter A filter representing a selection of records to update
   * @params patch The patch to apply of records selected by the filter
   * @return An promise containing the list of records that were updated
   */
  update(filter: Filter, patch: RecordData): Promise<void>;

  /**
   * Delete a list of records
   *
   * @params filter A filter representing a selection of records to delete
   * @return An empty promise
   */
  delete(filter: Filter): Promise<void>;

  /**
   * Aggregate filtered records
   *
   * @params filter A filter representing a selection of records to aggregate
   * @params aggregation The aggregation operation
   * @return The aggregated results
   */
  aggregate(filter: PaginatedFilter, aggregation: Aggregation): Promise<AggregateResult[]>;
}
