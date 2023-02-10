import {
  ActionField,
  ActionResult,
  Aggregation,
  Caller,
  Collection,
  ConditionTreeFactory,
  Filter,
  Page,
  Projection,
  RecordData,
  Sort,
} from '@forestadmin/datasource-toolkit';

import {
  TAggregateResult,
  TAggregation,
  TCollectionName,
  TFieldName,
  TFilter,
  TPartialSimpleRow,
  TRow,
  TSchema,
  TSimpleRow,
} from '../../templates';

/** Collection wrapper which accepts plain objects in all methods */
export default class RelaxedCollection<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> {
  private collection: Collection;
  private caller: Caller;

  constructor(collection: Collection, caller: Caller) {
    this.collection = collection;
    this.caller = caller;
  }

  /**
   * Execute a given action
   * @param name the name of the action
   * @param formValues the values of the form, if the action rely on an action form
   * @param filter the filter used to represent the selected records to use the action on
   * @example
   * .execute(
   *    'Refund',
   *    { reason: 'Article is broken' },
   *    {
   *      conditionTree: {
   *        field: 'id',
   *        operator: 'Equal',
   *        value: 1
   *      }
   *    }
   * );
   */
  execute(name: string, formValues: RecordData, filter?: TFilter<S, N>): Promise<ActionResult> {
    const filterInstance = this.buildFilter(filter);

    return this.collection.execute(this.caller, name, formValues, filterInstance);
  }

  getForm(name: string, formValues?: RecordData, filter?: TFilter<S, N>): Promise<ActionField[]> {
    const filterInstance = this.buildFilter(filter);

    return this.collection.getForm(this.caller, name, formValues, filterInstance);
  }

  /**
   * Create a list of records
   * @param data An array of records to create
   * @example
   * .create([
   *    { amountInEur: 150, description: 'Buy dvd' },
   *    { amountInEur: -100, description: 'Refund' },
   * ]);
   */
  create(data: TSimpleRow<S, N>[]): Promise<TSimpleRow<S, N>[]> {
    return this.collection.create(this.caller, data) as Promise<TSimpleRow<S, N>[]>;
  }

  /**
   * List multiple records
   * @param filter the filter used to select the records to list
   * @param projection an array of fields name representing the data to select
   * @example
   * .list({
   *    conditionTree: {
   *      aggregator: 'And',
   *      conditions: [{
   *        field: 'amountInEur',
   *        operator: 'GreaterThan',
   *        value: 1000
   *      }, {
   *        field: 'description',
   *        operator: 'Contains',
   *        value: 'Refund',
   *      }],
   *      page: { limit: 10, skip: 0 },
   *      sort: [{ field: 'id', ascending: true }]
   *   }
   * }, ['id', 'amountInEur', 'description']);
   */
  list(filter: TFilter<S, N>, projection: TFieldName<S, N>[]): Promise<TRow<S, N>[]> {
    const filterInstance = this.buildFilter(filter);
    const projectionInstance = this.buildProjection(projection);
    const rows = this.collection.list(this.caller, filterInstance, projectionInstance);

    return rows as Promise<TRow<S, N>[]>;
  }

  /**
   * Update a list of records
   * @param filter the filter that represent the list of records to update
   * @param patch the patch to apply on the selected records
   * @example
   * .update({
   *    conditionTree: {
   *      field: 'isActive',
   *      operator: 'Equal',
   *      value: false
   *    },
   * }, { isActive: true });
   */
  update(filter: TFilter<S, N>, patch: TPartialSimpleRow<S, N>): Promise<void> {
    const filterInstance = this.buildFilter(filter);

    return this.collection.update(this.caller, filterInstance, patch);
  }

  /**
   * Delete a list of records
   * @param filter the filter that represent the list of records to update
   * @example
   * .delete({
   *    conditionTree: {
   *      field: 'isBlocked',
   *      operator: 'Equal',
   *      value: false,
   *    },
   * });
   */
  delete(filter: TFilter<S, N>): Promise<void> {
    const filterInstance = this.buildFilter(filter);

    return this.collection.delete(this.caller, filterInstance);
  }

  /**
   * Aggregate a list of records
   * @param filter the filter used to list the records to aggregate
   * @param aggregation the aggregation to apply
   * @param limit the maximum number of result to return
   * @example
   * .aggregate({
   *    conditionTree: {
   *      field: "user:company:id",
   *      operator: "In",
   *      value: records.map((r) => r.id),
   *    },
   * }, {
   *    operation: "Sum",
   *    field: "amountInEur",
   *    groups: [{ field: "user:company:id" }],
   * }, 10);
   */
  async aggregate(
    filter: TFilter<S, N>,
    aggregation: TAggregation<S, N>,
    limit?: number,
  ): Promise<TAggregateResult<S, N>[]> {
    const filterInstance = this.buildFilter(filter);
    const aggregationInstance = this.buildAggregation(aggregation);
    const result = await this.collection.aggregate(
      this.caller,
      filterInstance,
      aggregationInstance,
      limit,
    );

    return result as TAggregateResult<S, N>[];
  }

  private buildFilter(filter: TFilter<S, N>): Filter {
    return new Filter({
      ...filter,
      conditionTree: filter?.conditionTree
        ? ConditionTreeFactory.fromPlainObject(filter.conditionTree)
        : undefined,
      sort: filter.sort ? new Sort(...filter.sort) : undefined,
      page: filter.page ? new Page(filter.page.skip, filter.page.limit) : undefined,
    });
  }

  private buildProjection(projection: string[]): Projection {
    return new Projection(...projection);
  }

  private buildAggregation(aggregation: TAggregation<S, N>): Aggregation {
    return new Aggregation(aggregation);
  }
}
