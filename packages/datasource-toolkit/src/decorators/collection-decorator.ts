import { ActionField, ActionLayoutElementOrPage, ActionResult } from '../interfaces/action';
import { Caller } from '../interfaces/caller';
import { Chart } from '../interfaces/chart';
import { Collection, DataSource, GetFormMetas } from '../interfaces/collection';
import Aggregation, { AggregateResult } from '../interfaces/query/aggregation';
import PaginatedFilter from '../interfaces/query/filter/paginated';
import Filter from '../interfaces/query/filter/unpaginated';
import Projection from '../interfaces/query/projection';
import { CompositeId, RecordData } from '../interfaces/record';
import { CollectionSchema } from '../interfaces/schema';

export default class CollectionDecorator implements Collection {
  readonly dataSource: DataSource;
  protected childCollection: Collection;

  private lastSchema: CollectionSchema;

  get nativeDriver(): unknown {
    return this.childCollection.nativeDriver;
  }

  get schema(): CollectionSchema {
    if (!this.lastSchema) {
      // If the schema is not cached (at the first call, or after a markSchemaAsDirty call),
      const subSchema = this.childCollection.schema;
      this.lastSchema = this.refineSchema(subSchema);
    }

    return this.lastSchema;
  }

  get name(): string {
    return this.childCollection.name;
  }

  constructor(childCollection: Collection, dataSource: DataSource) {
    this.childCollection = childCollection;
    this.dataSource = dataSource;

    // When the child collection invalidates its schema, we also invalidate ours.
    // This is done like this, and not in the markSchemaAsDirty method, because we don't have
    // a reference to parent collections from children.
    if (childCollection instanceof CollectionDecorator) {
      const originalChildMarkSchemaAsDirty = childCollection.markSchemaAsDirty;

      childCollection.markSchemaAsDirty = () => {
        // Call the original method (the child)
        originalChildMarkSchemaAsDirty.call(childCollection);

        // Invalidate our schema (the parent)
        this.markSchemaAsDirty();
      };
    }
  }

  async execute(
    caller: Caller,
    name: string,
    data: RecordData,
    filter?: Filter,
  ): Promise<ActionResult> {
    const refinedFilter = await this.refineFilter(caller, filter);

    return this.childCollection.execute(caller, name, data, refinedFilter);
  }

  async getForm(
    caller: Caller,
    name: string,
    data?: RecordData,
    filter?: Filter,
    metas?: GetFormMetas,
  ): Promise<{ fields: ActionField[]; layout: ActionLayoutElementOrPage[] }> {
    const refinedFilter = await this.refineFilter(caller, filter);

    return this.childCollection.getForm(caller, name, data, refinedFilter, metas);
  }

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    return this.childCollection.create(caller, data);
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const refinedFilter = await this.refineFilter(caller, filter);

    return this.childCollection.list(caller, refinedFilter, projection);
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const refinedFilter = await this.refineFilter(caller, filter);

    return this.childCollection.update(caller, refinedFilter, patch);
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    const refinedFilter = await this.refineFilter(caller, filter);

    return this.childCollection.delete(caller, refinedFilter);
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const refinedFilter = await this.refineFilter(caller, filter);

    return this.childCollection.aggregate(caller, refinedFilter, aggregation, limit);
  }

  async renderChart(caller: Caller, name: string, recordId: CompositeId): Promise<Chart> {
    return this.childCollection.renderChart(caller, name, recordId);
  }

  protected markSchemaAsDirty(): void {
    this.lastSchema = null;
  }

  protected async refineFilter(caller: Caller, filter?: PaginatedFilter): Promise<PaginatedFilter> {
    return filter;
  }

  protected refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return subSchema;
  }
}
