import { Collection, DataSource } from '../../../interfaces/collection';
import { RecordData } from '../../../interfaces/record';
import Deferred from '../../../utils/async';
import Filter from '../../../interfaces/query/filter/unpaginated';
import Projection from '../../../interfaces/query/projection';
import ProjectionValidator from '../../../validation/projection';

export default class ActionContext {
  readonly collection: Collection;
  readonly formValues: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  public filter: Filter;

  private queries: Array<{ projection: Projection; deferred: Deferred<RecordData[]> }>;
  private projection: Projection;

  get dataSource(): DataSource {
    return this.collection.dataSource;
  }

  constructor(collection: Collection, formValue: RecordData, filter: Filter, used?: Set<string>) {
    this.collection = collection;
    this.formValues = formValue;
    this.filter = filter;
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
    }
  }

  protected async getRecords(fields: string[]): Promise<RecordData[]> {
    // This function just queues the request into this.queries, so that we can merge all calls
    // to getRecords() into a single one.

    // The call to setTimeout which resolve the promises will trigger only once all handlers in
    // the customer's form have been called as Promises are queued before calls to setTimeout
    // in NodeJS event loop

    // @see https://dev.to/khaosdoctor/node-js-under-the-hood-3-deep-dive-into-the-event-loop-135d\
    //   #microtasks-and-macrotasks
    //   Ordering of micro/macro tasks in NodeJS event loop
    //
    // @see https://github.com/graphql/dataloader
    //   A library from facebook from which this pattern is inspired.

    ProjectionValidator.validate(this.collection, fields);

    const deferred = new Deferred<RecordData[]>();
    const projection = new Projection(...fields);

    if (this.queries.length === 0) setTimeout(() => this.runQuery());
    this.queries.push({ projection, deferred });
    this.projection = this.projection.union(projection);

    return deferred.promise;
  }

  private async runQuery(): Promise<void> {
    const { queries, projection } = this;
    this.reset();

    try {
      // Run a single query which contains all fields / relations which were requested by
      // the different calls made to getRecords
      const records = await this.collection.list(this.filter, projection);

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
}
