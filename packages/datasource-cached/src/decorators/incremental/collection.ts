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
import { SynchronizeOutput } from '../../types';

export default class IncrementalCollectionDecorator extends CollectionDecorator {
  override dataSource: IncrementalDataSourceDecorator;

  syncLastStarted = null;

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const records = await this.childCollection.create(caller, data);

    if (this.options.syncOnAfterCreate) {
      await this.incrementalSync(state => {
        const context = new AfterCreateIncrementalSyncContext(this, caller, data, records);
        context.state = state;

        return this.options.syncOnAfterCreate(context);
      }, true);
    }

    return records;
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    await super.update(caller, filter, patch);

    if (this.options.syncOnAfterUpdate) {
      await this.incrementalSync(state => {
        const context = new AfterUpdateIncrementalSyncContext(this, caller, filter, patch);
        context.state = state;

        return this.options.syncOnAfterUpdate(context);
      }, true);
    }
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    await super.delete(caller, filter);

    if (this.options.syncOnAfterDelete) {
      await this.incrementalSync(state => {
        const context = new AfterDeleteIncrementalSyncContext(this, caller, filter);
        context.state = state;

        return this.options.syncOnAfterDelete(context);
      }, true);
    }
  }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    if (this.options.syncOnBeforeList) {
      await this.incrementalSync(state => {
        const context = new BeforeListIncrementalSyncContext(this, caller, filter, projection);
        context.state = state;

        return this.options.syncOnBeforeList(context);
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
    await this.incrementalSync(state => {
      const context = new BeforeAggregateIncrementalSyncContext(this, caller, filter, aggregation);
      context.state = state;

      return this.options.syncOnBeforeAggregate(context);
    });

    return super.aggregate(caller, filter, aggregation, limit);
  }

  private async incrementalSync(
    handler: (state: unknown) => Promise<SynchronizeOutput>,
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

      // Fetch changes
      const changes = await handler(state);

      // Update records in database
      for (const record of changes.newOrUpdatedRecords) await model.upsert(record);
      for (const record of changes.deletedRecords) await model.destroy({ where: record });

      // Update state in database
      await stateModel.upsert({ id: this.name, state: JSON.stringify(changes.newState) });

      more = changes.more;
    }
  }

  private get options() {
    return this.dataSource.options;
  }

  private get sequelize() {
    return this.dataSource.connection;
  }
}
