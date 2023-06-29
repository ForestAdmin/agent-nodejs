/* eslint-disable no-await-in-loop */
import {
  AggregateResult,
  Aggregation,
  Caller,
  CollectionDecorator,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import SyncDataSourceDecorator from './data-source';

export default class SyncCollectionDecorator extends CollectionDecorator {
  override dataSource: SyncDataSourceDecorator;

  get shortName(): string {
    return this.name.substring(this.dataSource.options.namespace.length + 1);
  }

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const records = await this.childCollection.create(caller, data);

    if ('getDelta' in this.dataSource.options && this.dataSource.options.deltaOnAfterWrite) {
      const reason = 'after-create';
      const collections = [this.shortName];
      await this.dataSource.queueDelta({ reason, caller, collections, records });
    }

    return records;
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    await super.update(caller, filter, patch);

    if ('getDelta' in this.dataSource.options && this.dataSource.options.deltaOnAfterWrite) {
      const reason = 'after-update';
      const collections = [this.shortName];
      await this.dataSource.queueDelta({ reason, caller, filter, patch, collections });
    }
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    await super.delete(caller, filter);

    if ('getDelta' in this.dataSource.options && this.dataSource.options.deltaOnAfterWrite) {
      // Deletes may cascade to other collections!
      // Let's find out which one are affected assuming that all deletes cascade
      // (which is the worst case scenario)
      const reason = 'after-delete';
      const collections = this.getLinkedCollections(new Set());
      await this.dataSource.queueDelta({ reason, caller, filter, collections });
    }
  }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    if ('getDelta' in this.dataSource.options && this.dataSource.options.deltaOnBeforeAccess) {
      const reason = 'before-list';
      const collections = this.getCollectionsFromProjection(projection);
      await this.dataSource.queueDelta({ reason, caller, filter, projection, collections });
    }

    return super.list(caller, filter, projection);
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    if ('getDelta' in this.dataSource.options && this.dataSource.options.deltaOnBeforeAccess) {
      const reason = 'before-aggregate';
      const collections = this.getCollectionsFromProjection(aggregation.projection);
      await this.dataSource.queueDelta({ reason, caller, filter, aggregation, collections });
    }

    return super.aggregate(caller, filter, aggregation, limit);
  }

  private getLinkedCollections(exclude: Set<string>): string[] {
    const set = new Set<string>();
    set.add(this.shortName);

    Object.values(this.schema.fields).forEach(f => {
      if (f.type === 'ManyToOne' || f.type === 'OneToOne') {
        const collection = this.dataSource.getCollection(f.foreignCollection);

        if (!exclude.has(collection.shortName)) {
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
    const schema = this.childCollection.schema.fields[prefix];

    return schema.type === 'Column'
      ? this.shortName
      : this.dataSource.getCollection(schema.foreignCollection).getCollectionFromPath(suffix);
  }
}
