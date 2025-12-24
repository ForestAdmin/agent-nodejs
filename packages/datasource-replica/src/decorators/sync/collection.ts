import type TriggerSyncDataSourceDecorator from './data-source';
import type { TFilter, TPaginatedFilter } from '@forestadmin/datasource-customizer';
import type {
  AggregateResult,
  Aggregation,
  Caller,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import { CollectionDecorator, SchemaUtils } from '@forestadmin/datasource-toolkit';

export default class SyncCollectionDecorator extends CollectionDecorator {
  override dataSource: TriggerSyncDataSourceDecorator;

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const { options } = this.dataSource;
    const records = await this.childCollection.create(caller, data);

    if (options.pullDeltaOnAfterWrite) {
      await options.source.queuePullDelta({
        name: 'after-create',
        collection: this.name,
        caller,
        affectedCollections: [this.name],
        records,
      });
    }

    return records;
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const { options } = this.dataSource;

    await super.update(caller, filter, patch);

    if (options.pullDeltaOnAfterWrite) {
      await options.source.queuePullDelta({
        name: 'after-update',
        collection: this.name,
        affectedCollections: [this.name],
        caller,
        filter: filter as unknown as TFilter,
        patch,
      });
    }
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    const { options } = this.dataSource;

    await super.delete(caller, filter);

    if (options.pullDeltaOnAfterWrite) {
      // Deletes may cascade to other collections!
      // Let's find out which one are affected assuming that all deletes cascade
      // (which is the worst case scenario)
      await options.source.queuePullDelta({
        name: 'after-delete',
        collection: this.name,
        affectedCollections: this.getLinkedCollections(new Set()),
        caller,
        filter: filter as unknown as TFilter,
      });
    }
  }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const { options } = this.dataSource;

    if (options.pullDeltaOnBeforeAccess) {
      await options.source.queuePullDelta({
        name: 'before-list',
        collection: this.name,
        affectedCollections: this.getCollectionsFromProjection(projection),
        caller,
        filter: filter as unknown as TPaginatedFilter,
        projection,
      });
    }

    return super.list(caller, filter, projection);
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const { options } = this.dataSource;

    if (options.pullDeltaOnBeforeAccess) {
      await options.source.queuePullDelta({
        name: 'before-aggregate',
        collection: this.name,
        affectedCollections: this.getCollectionsFromProjection(aggregation.projection),
        caller,
        filter: filter as unknown as TFilter,
        aggregation,
      });
    }

    return super.aggregate(caller, filter, aggregation, limit);
  }

  private getLinkedCollections(exclude: Set<string>): string[] {
    const set = new Set<string>();
    set.add(this.name);

    Object.values(this.schema.fields).forEach(f => {
      if (f.type === 'ManyToOne' || f.type === 'OneToOne') {
        const collection = this.dataSource.getCollection(f.foreignCollection);

        if (!exclude.has(collection.name)) {
          collection.getLinkedCollections(set).forEach(c => set.add(c));
        }
      }
    });

    return [...set];
  }

  private getCollectionsFromProjection(projection: Projection): string[] {
    const set = new Set<string>();
    for (const field of projection) set.add(this.getCollectionFromPath(field));

    return [...set];
  }

  private getCollectionFromPath(path: string): string {
    const [prefix, suffix] = path.split(/:(.*)/);
    const schema = SchemaUtils.getField(
      this.childCollection.schema,
      prefix,
      this.childCollection.name,
    );

    // FIXME need to handle many to many relationships here
    // the through table is not included, and it should be
    return schema.type === 'Column'
      ? this.name
      : this.dataSource.getCollection(schema.foreignCollection).getCollectionFromPath(suffix);
  }
}
