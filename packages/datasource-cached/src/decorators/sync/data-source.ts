/* eslint-disable no-await-in-loop */
import RelaxedDataSource from '@forestadmin/datasource-customizer/dist/context/relaxed-wrappers/datasource';
import {
  DataSource,
  DataSourceDecorator,
  Deferred,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';

import SyncCollectionDecorator from './collection';
import { flattenRecord } from '../../flattener';
import { DeltaReason, DumpReason, RecordDataWithCollection, ResolvedOptions } from '../../types';

type Queue<Reason> = {
  /**
   * A deferred which allows callers of queueDump/queueDelta to wait that their request is processed
   */
  deferred: Deferred<void>;

  /**
   * The list of reasons why we want to dump/delta
   */
  reasons: (Reason & { at: Date })[];
};

export default class SyncDataSourceDecorator extends DataSourceDecorator<SyncCollectionDecorator> {
  options: ResolvedOptions;

  private connection: Sequelize;
  private dumpRunning = false;
  private deltaRunning = false;
  private queuedDumpReasons: Queue<DumpReason> = null;
  private queuedDeltaReasons: Queue<DeltaReason> = null;

  private timers: NodeJS.Timer[] = [];

  constructor(childDataSource: DataSource, connection: Sequelize, options: ResolvedOptions) {
    super(childDataSource, SyncCollectionDecorator);

    this.connection = connection;
    this.options = options;
  }

  async start(): Promise<void> {
    const collections = this.collections.map(c => c.name);

    if ('getDump' in this.options && this.options.dumpOnStartup)
      await this.queueDump({ reason: 'startup', collections });

    if ('getDelta' in this.options && this.options.deltaOnStartup)
      await this.queueDelta({ reason: 'startup', collections });

    if ('getDump' in this.options && this.options.dumpOnTimer)
      this.timers.push(
        setInterval(
          () => this.queueDump({ reason: 'timer', collections }),
          this.options.dumpOnTimer,
        ),
      );

    if ('getDelta' in this.options && this.options.deltaOnTimer)
      this.timers.push(
        setInterval(
          () => this.queueDelta({ reason: 'timer', collections }),
          this.options.deltaOnTimer,
        ),
      );
  }

  async stop(): Promise<void> {
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.length = 0;
  }

  async queueDump(reason: DumpReason): Promise<void> {
    if (!this.queuedDumpReasons) this.queuedDumpReasons = { deferred: new Deferred(), reasons: [] };

    const { deferred } = this.queuedDumpReasons;
    this.queuedDumpReasons.reasons.push({ ...reason, at: new Date() });
    this.tick();

    return deferred.promise;
  }

  queueDelta(reason: DeltaReason): Promise<void> {
    if (!this.queuedDeltaReasons)
      this.queuedDeltaReasons = { deferred: new Deferred(), reasons: [] };

    const { deferred } = this.queuedDeltaReasons;
    this.queuedDeltaReasons.reasons.push({ ...reason, at: new Date() });

    // We wait for the access delay before running the delta
    // This allows to batch delta requests at the cost of adding a floor delay to all requests.
    setTimeout(() => this.tick(), this.options.deltaAccessDelay ?? 0);

    return deferred.promise;
  }

  private tick(): void {
    if (!this.dumpRunning && !this.deltaRunning) {
      if (this.queuedDumpReasons) {
        this.runDump(this.queuedDumpReasons);
        this.queuedDumpReasons = null;
      } else if (this.queuedDeltaReasons) {
        this.runDelta(this.queuedDeltaReasons);
        this.queuedDeltaReasons = null;
      }
    }
  }

  private async runDump(queue: Queue<DumpReason>): Promise<void> {
    this.dumpRunning = true;

    let state = null;
    let more = true;

    // Truncate tables (we should write to a temporary table and swap the tables to avoid downtime)
    for (const collection of this.collections) {
      await this.connection.model(collection.name).destroy({ truncate: true });
    }

    // Fill table with dump
    while (more) {
      const changes = await this.options.getDump({
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

    this.dumpRunning = false;
    queue.deferred.resolve();
    this.tick();
  }

  private async runDelta(queue: Queue<DeltaReason>) {
    this.deltaRunning = true;

    let more = true;

    while (more) {
      // Update records in database
      const previousState = await this.getDeltaState();
      const changes = await this.options.getDelta({
        reasons: queue.reasons,
        collections: [...new Set(queue.reasons.flatMap(r => r.collections))],
        cache: new RelaxedDataSource(this.childDataSource, null),
        previousDeltaState: previousState,
      });

      // FIXME update & deletes should be broken because of the flattenRecord
      const updatedEntries = changes.newOrUpdatedEntries.flatMap(entry =>
        this.flattenRecord(entry),
      );
      const deletedEntries = changes.deletedEntries.flatMap(entry => this.flattenRecord(entry));
      for (const entry of deletedEntries)
        await this.connection.model(entry.collection).destroy({ where: entry.record });
      for (const entry of updatedEntries)
        await this.connection.model(entry.collection).upsert(entry.record);

      // Update state in database
      await this.setDeltaState(changes.nextDeltaState);

      more = changes.more;
    }

    this.deltaRunning = false;
    queue.deferred.resolve();
    this.tick();
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

  private flattenRecord(
    recordWithCollection: RecordDataWithCollection,
  ): RecordDataWithCollection[] {
    return flattenRecord(
      recordWithCollection,
      this.options.schema.find(s => s.name === recordWithCollection.collection).fields,
      this.options?.flattenOptions?.[recordWithCollection.collection]?.asFields ?? [],
      this.options?.flattenOptions?.[recordWithCollection.collection]?.asModels ?? [],
    );
  }
}
