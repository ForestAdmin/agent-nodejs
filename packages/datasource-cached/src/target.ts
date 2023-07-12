/* eslint-disable max-classes-per-file */
/* eslint-disable no-await-in-loop */
import RelaxedDataSource from '@forestadmin/datasource-customizer/dist/context/relaxed-wrappers/datasource';
import { Deferred } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';

import { flattenRecord } from './flattener';
import {
  CachedDataSourceOptions,
  PullDeltaReason,
  PullDumpReason,
  PullDumpResponse,
  PushDeltaResponse,
  RecordDataWithCollection,
} from './types';
import { getRecordId } from './utils';

class PullDumpResponseEvent extends Event {
  response: PullDumpResponse;

  constructor(response: PullDumpResponse) {
    super('pullDumpResponse');

    this.response = response;
  }
}

export default class Target extends EventTarget {
  cache: RelaxedDataSource = null;

  private options: CachedDataSourceOptions;
  private connection: Sequelize;
  private isRunning = false;

  private queuedPullDumpReasons: Queue<PullDumpReason> = null;
  private queuedPullDeltaReasons: Queue<PullDeltaReason> = null;
  private queuedPushDeltaRequest: PushDeltaResponse = null;

  private timers: NodeJS.Timer[] = [];

  constructor(connection: Sequelize, options: CachedDataSourceOptions) {
    super();
    this.connection = connection;
    this.options = options;
  }

  async start(): Promise<void> {
    const collections = this.collections.map(c => c.name);

    if (this.options.pushDeltaHandler) {
      const previousDeltaState = await this.getDeltaState();
      this.options.pushDeltaHandler({ cache: this.cache, previousDeltaState }, changes =>
        this.runPushDelta(changes),
      );
    }

    if (this.options.pullDumpHandler && this.options.pullDumpOnRestart)
      await this.queuePullDump({ reason: 'startup', collections });

    if (this.options.pullDeltaHandler && this.options.pullDeltaOnRestart)
      await this.queuePullDelta({ reason: 'startup', collections });

    if (this.options.pullDumpHandler && this.options.pullDumpOnTimer)
      this.timers.push(
        setInterval(
          () => this.queuePullDump({ reason: 'timer', collections }),
          this.options.pullDumpOnTimer,
        ),
      );

    if (this.options.pullDeltaHandler && this.options.pullDeltaOnTimer)
      this.timers.push(
        setInterval(
          () => this.queuePullDelta({ reason: 'timer', collections }),
          this.options.pullDeltaOnTimer,
        ),
      );
  }

  async stop(): Promise<void> {
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.length = 0;
  }

  queuePushDelta(delta: PushDeltaResponse): void {
    if (!this.queuedPushDeltaRequest)
      this.queuedPushDeltaRequest = { newOrUpdatedEntries: [], deletedEntries: [] };

    this.queuedPushDeltaRequest.deletedEntries.push(...delta.deletedEntries);
    this.queuedPushDeltaRequest.newOrUpdatedEntries.push(...delta.newOrUpdatedEntries);
    if (delta.nextDeltaState) this.queuedPushDeltaRequest.nextDeltaState = delta.nextDeltaState;
  }

  queuePullDump(reason: PullDumpReason): Promise<void> {
    if (!this.queuedPullDumpReasons)
      this.queuedPullDumpReasons = { deferred: new Deferred(), reasons: [] };

    const { deferred } = this.queuedPullDumpReasons;
    this.queuedPullDumpReasons.reasons.push({ ...reason, at: new Date() });
    this.tick();

    return deferred.promise;
  }

  queuePullDelta(reason: PullDeltaReason): Promise<void> {
    if (!this.queuedPullDeltaReasons)
      this.queuedPullDeltaReasons = { deferred: new Deferred(), reasons: [] };

    const { deferred } = this.queuedPullDeltaReasons;
    this.queuedPullDeltaReasons.reasons.push({ ...reason, at: new Date() });

    // We wait for the access delay before running the delta
    // This allows to batch delta requests at the cost of adding a floor delay to all requests.
    if (this.options.pullDeltaOnBeforeAccessDelay)
      setTimeout(() => this.tick(), this.options.pullDeltaOnBeforeAccessDelay);
    else this.tick();

    return deferred.promise;
  }

  private tick(): void {
    if (!this.isRunning) {
      if (this.queuedPushDeltaRequest) {
        this.runPushDelta(this.queuedPushDeltaRequest);
        this.queuedPushDeltaRequest = null;
      } else if (this.queuedPullDumpReasons) {
        this.runPullDump(this.queuedPullDumpReasons);
        this.queuedPullDumpReasons = null;
      } else if (this.queuedPullDeltaReasons) {
        this.runPullDelta(this.queuedPullDeltaReasons);
        this.queuedPullDeltaReasons = null;
      }
    }
  }

  private async runPushDelta(changes: PushDeltaResponse): Promise<void> {
    this.isRunning = true;

    this.applyDelta(changes);

    this.isRunning = false;
    this.tick();
  }

  private async runPullDump(queue: Queue<PullDumpReason>): Promise<void> {
    this.isRunning = true;

    let state = null;
    let more = true;

    // Truncate tables (we should write to a temporary table and swap the tables to avoid downtime)
    for (const collection of this.collections) {
      await this.connection.model(collection.name).destroy({ truncate: true });
    }

    // Fill table with dump
    while (more) {
      const changes = await this.options.pullDumpHandler({
        reasons: queue.reasons,
        collections: [...new Set(queue.reasons.flatMap(r => r.collections))],
        cache: new RelaxedDataSource(this.childDataSource, null),
        previousDumpState: state,
      });

      const recordsByCollection = {} as Record<string, RecordData[]>;
      const entries = changes.entries.flatMap(entry => this.flattenRecord(entry));

      for (const entry of entries) {
        if (!recordsByCollection[entry.collection]) recordsByCollection[entry.collection] = [];
        recordsByCollection[entry.collection].push(entry.record);
      }

      for (const [collection, records] of Object.entries(recordsByCollection))
        await this.connection.model(collection).bulkCreate(records);

      more = changes.more;
      if (changes.more === true) state = changes.nextDumpState;
      if (changes.more === false && changes.nextDeltaState)
        await this.setDeltaState(changes.nextDeltaState);
    }

    this.isRunning = false;
    queue.deferred.resolve();
    this.tick();
  }

  private async runPullDelta(queue: Queue<PullDeltaReason>) {
    this.isRunning = true;

    let more = true;

    while (more) {
      // Update records in database
      const previousState = await this.getDeltaState();
      const changes = await this.options.pullDeltaHandler({
        reasons: queue.reasons,
        collections: [...new Set(queue.reasons.flatMap(r => r.collections))],
        cache: this.cache,
        previousDeltaState: previousState,
      });

      await this.applyDelta(changes);
      more = changes.more;
    }

    this.isRunning = false;
    queue.deferred.resolve();
    this.tick();
  }

  private async applyDelta(changes: PushDeltaResponse): Promise<void> {
    for (const entry of changes.deletedEntries) {
      await this.destroySubModels(entry);
      await this.connection.model(entry.collection).destroy({ where: entry.record });
    }

    // Usert records in both root and virtual collections
    for (const entry of changes.newOrUpdatedEntries) {
      await this.destroySubModels(entry);
      for (const subEntry of this.flattenRecord(entry))
        await this.connection.model(subEntry.collection).upsert(subEntry.record);
    }

    // Update state in database
    if (changes.nextDeltaState !== undefined) await this.setDeltaState(changes.nextDeltaState);
  }

  private async getDeltaState(): Promise<unknown> {
    const stateModel = this.connection.model(`forest_sync_state`);
    const stateRecord = await stateModel.findByPk(this.options.cacheNamespace);

    return stateRecord ? JSON.parse(stateRecord.dataValues.state) : null;
  }

  private async setDeltaState(state: unknown): Promise<void> {
    const stateModel = this.connection.model(`forest_sync_state`);
    await stateModel.upsert({ id: this.options.cacheNamespace, state: JSON.stringify(state) });
  }
}
