/* eslint-disable max-classes-per-file */
import type { TCollectionName, TFieldName, TFilter, TRow, TSchema } from '../../../templates';
import type { Caller, Collection, CompositeId, RecordData } from '@forestadmin/datasource-toolkit';

import {
  Deferred,
  Projection,
  ProjectionValidator,
  RecordUtils,
} from '@forestadmin/datasource-toolkit';

import CollectionCustomizationContext from '../../../context/collection-context';

export default class ActionContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends CollectionCustomizationContext<S, N> {
  readonly formValues: RecordData;
  readonly filter: TFilter<S, N>;
  readonly actionIntentParams: Record<string, unknown> | null;

  private _changedField: string;

  /**
   * @deprecated use `hasFieldChange` instead. [linked issue](https://github.com/ForestAdmin/agent-nodejs/issues/815).
   * @todo remove accessor
   */
  get changedField() {
    console.warn(
      '\x1b[33mwarning:\x1b[0m',
      'Usage of `changedField` is deprecated, please use `hasFieldChanged` instead.',
    );

    return this._changedField;
  }

  private queries: Array<{ projection: Projection; deferred: Deferred<RecordData[]> }>;
  private projection: Projection;

  public hasFieldChanged: (fieldName: string) => boolean;

  constructor(
    collection: Collection,
    caller: Caller,
    formValue: RecordData,
    filter: TFilter<S, N>,
    used?: Set<string>,
    changedField?: string,
    actionIntentParams?: Record<string, unknown>,
  ) {
    super(collection, caller);
    this.formValues = formValue;
    this.filter = filter;
    this._changedField = changedField;
    this.actionIntentParams = actionIntentParams;
    this.reset();

    // Spy on which formValues are accessed to set-up change hooks
    if (used) {
      this.formValues = new Proxy(this.formValues, {
        get: (target, prop, receiver) => {
          if (typeof prop === 'string') used.add(prop);

          return Reflect.get(target, prop, receiver);
        },
        set: () => {
          throw new Error('formValues is readonly');
        },
      });

      this.hasFieldChanged = (fieldName: string) => {
        used.add(fieldName);

        return this._changedField === fieldName;
      };
    }
  }

  /**
   * Get all the records selected by an action
   * @param fields An array of fields needed in the response
   * @example
   * .getRecords(['id', 'isActive', 'name']);
   */
  async getRecords(fields: TFieldName<S, N>[]): Promise<TRow<S, N>[]> {
    // This function just queues the request into this.queries, so that we can merge all calls
    // to getRecords() into a single one.

    // The call to setTimeout which resolve the promises will trigger only once all handlers in
    // the customer's form have been called as Promises are queued before calls to setTimeout
    // in Node.js event loop

    // @see https://dev.to/khaosdoctor/node-js-under-the-hood-3-deep-dive-into-the-event-loop-135d\
    //   #microtasks-and-macrotasks
    //   Ordering of micro/macro tasks in Node.js event loop
    //
    // @see https://github.com/graphql/dataloader
    //   A library from facebook from which this pattern is inspired.

    ProjectionValidator.validate(this.realCollection, fields);

    const deferred = new Deferred<TRow<S, N>[]>();
    const projection = new Projection(...fields);

    if (this.queries.length === 0) setTimeout(() => this.runQuery());
    this.queries.push({ projection, deferred });
    this.projection = this.projection.union(projection);

    return deferred.promise;
  }

  /**
   * Get all the records ids selected by an action
   */
  async getRecordIds(): Promise<Array<string | number>> {
    const compositeIds = await this.getCompositeRecordIds();
    this.assertSomeRecordsMatch(compositeIds);

    return compositeIds.map(id => id[0]);
  }

  /**
   * Get all the records ids (when the collection uses composite keys)
   */
  async getCompositeRecordIds(): Promise<CompositeId[]> {
    const projection = new Projection().withPks(this.realCollection) as string[];
    const records = await this.getRecords(projection as TFieldName<S, N>[]);

    return records.map(r => RecordUtils.getPrimaryKey(this.realCollection.schema, r));
  }

  private async runQuery(): Promise<void> {
    const { queries, projection } = this;
    this.reset();

    try {
      // Run a single query which contains all fields / relations which were requested by
      // the different calls made to getRecords
      const records = await this.collection.list(
        this.filter,
        projection as string[] as TFieldName<S, N>[],
      );

      // Resolve each on of the promises only with the requested fields.
      for (const query of queries) query.deferred.resolve(query.projection.apply(records));
    } catch (e) {
      // Rejecting each promises at next tick

      // This ensures that we don't let any promise hanging forever if the customer throws in
      // the rejection handler.
      for (const query of queries) {
        process.nextTick(() => query.deferred.reject(e));
      }
    }
  }

  private reset(): void {
    this.queries = [];
    this.projection = new Projection();
  }

  protected assertSomeRecordsMatch(records) {
    // The record might have been deleted since then
    if (!records?.length) throw new Error('Query with filter did not match any records');
  }
}
