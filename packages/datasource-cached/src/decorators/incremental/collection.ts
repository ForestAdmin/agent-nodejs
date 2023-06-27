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

import {
  AfterCreateIncrementalSyncContext,
  AfterDeleteIncrementalSyncContext,
  AfterUpdateIncrementalSyncContext,
  BeforeAggregateIncrementalSyncContext,
  BeforeListIncrementalSyncContext,
} from './context';
import IncrementalDataSourceDecorator from './data-source';
import { IncrementalOutput } from '../../types';

export default class IncrementalCollectionDecorator extends CollectionDecorator {
  override dataSource: IncrementalDataSourceDecorator;

  syncLastStarted = null;

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const records = await this.childCollection.create(caller, data);
    if (this.options.syncOnAfterCreate)
      await this.onAfterCreate(new AfterCreateIncrementalSyncContext(this, caller, data, records));

    return records;
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    await super.update(caller, filter, patch);

    if (this.options.syncOnAfterUpdate)
      await this.onAfterUpdate(new AfterUpdateIncrementalSyncContext(this, caller, filter, patch));
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    await super.delete(caller, filter);

    if (this.options.syncOnAfterDelete)
      await this.onAfterDelete(new AfterDeleteIncrementalSyncContext(this, caller, filter));
  }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    if (this.options.syncOnBeforeList) {
      for (const collection of this.getCollectionsFromProjection(projection)) {
        // We need nesting here.
        const context = new BeforeListIncrementalSyncContext(
          collection,
          caller,
          filter,
          projection,
        );
        await collection.onBeforeList(context);
      }
    }

    return super.list(caller, filter, projection);
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    if (this.options.syncOnBeforeAggregate)
      await this.onBeforeAggregate(
        new BeforeAggregateIncrementalSyncContext(this, caller, filter, aggregation, limit),
      );

    return super.aggregate(caller, filter, aggregation, limit);
  }

  private async onAfterCreate(context: AfterCreateIncrementalSyncContext): Promise<void> {
    await this.incrementalSync(state => {
      context.state = state;

      return this.options.syncOnAfterCreate(context);
    }, true);
  }

  private async onAfterUpdate(context: AfterUpdateIncrementalSyncContext): Promise<void> {
    await this.incrementalSync(state => {
      context.state = state;

      return this.options.syncOnAfterUpdate(context);
    }, true);
  }

  private async onAfterDelete(context: AfterDeleteIncrementalSyncContext): Promise<void> {
    await this.incrementalSync(state => {
      context.state = state;

      return this.options.syncOnAfterDelete(context);
    }, true);
  }

  private async onBeforeList(context: BeforeListIncrementalSyncContext): Promise<void> {
    await this.incrementalSync(state => {
      context.state = state;

      return this.options.syncOnBeforeList(context);
    });
  }

  private async onBeforeAggregate(context: BeforeAggregateIncrementalSyncContext): Promise<void> {
    await this.incrementalSync(state => {
      context.state = state;

      return this.options.syncOnBeforeAggregate(context);
    });
  }

  private async incrementalSync(
    handler: (state: unknown) => Promise<IncrementalOutput>,
    ignoreTimers = false,
  ) {
    this.syncLastStarted = new Date();

    if (!ignoreTimers && this.options.minDelayBetweenSync > Date.now() - this.syncLastStarted) {
      return;
    }

    const model = this.sequelize.model(this.name);
    const stateModel = this.sequelize.model(`forest_sync_state`);

    let more = true;

    while (more) {
      // Get state from database
      const stateRecord = await stateModel.findByPk(this.name);
      const state = stateRecord ? JSON.parse(stateRecord.dataValues.state) : undefined;

      // Update records in database
      const changes = await handler(state);
      for (const record of changes.newOrUpdatedRecords) await model.upsert(record);
      for (const record of changes.deletedRecords) await model.destroy({ where: record });

      // Update state in database
      await stateModel.upsert({ id: this.name, state: JSON.stringify(changes.newState) });

      more = changes.more;
    }
  }

  private getCollectionsFromProjection(projection: Projection): IncrementalCollectionDecorator[] {
    const set = new Set<IncrementalCollectionDecorator>();

    for (const field of projection) {
      set.add(this.getCollectionFromPath(field));
    }

    return [...set];
  }

  private getCollectionFromPath(path: string): IncrementalCollectionDecorator {
    const [prefix, suffix] = path.split(/:(.*)/);
    const schema = this.childCollection.schema.fields[prefix];

    return schema.type === 'Column'
      ? this
      : this.dataSource.getCollection(schema.foreignCollection).getCollectionFromPath(suffix);
  }

  private get options() {
    return this.dataSource.options;
  }

  private get sequelize() {
    return this.dataSource.connection;
  }
}
