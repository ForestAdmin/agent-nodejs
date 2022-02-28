import { Collection, DataSource } from '../../../interfaces/collection';
import { RecordData } from '../../../interfaces/record';
import Deferred from '../../../utils/async';
import Filter from '../../../interfaces/query/filter/unpaginated';
import Projection from '../../../interfaces/query/projection';

export default class ActionContext {
  readonly collection: Collection;
  readonly formValues: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  protected filter: Filter;

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

    const records = await this.collection.list(this.filter, projection);

    for (const query of queries) {
      query.deferred.resolve(query.projection.apply(records));
    }
  }

  private reset(): void {
    this.queries = [];
    this.projection = new Projection();
  }
}
