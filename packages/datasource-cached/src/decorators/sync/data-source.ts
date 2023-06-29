/* eslint-disable no-await-in-loop */
import RelaxedDataSource from '@forestadmin/datasource-customizer/dist/context/relaxed-wrappers/datasource';
import {
  DataSource,
  DataSourceDecorator,
  Deferred,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { Model, ModelStatic, Sequelize } from 'sequelize';

import SyncCollectionDecorator from './collection';
import {
  CachedDataSourceOptions,
  DeltaOptions,
  DeltaReason,
  DumpOptions,
  DumpReason,
} from '../../types';

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
  options: CachedDataSourceOptions;

  private connection: Sequelize;
  private dumpRunning = false;
  private deltaRunning = false;
  private queuedDumpReasons: Queue<DumpReason> = null;
  private queuedDeltaReasons: Queue<DeltaReason> = null;

  private timers: NodeJS.Timer[] = [];

  constructor(
    childDataSource: DataSource,
    connection: Sequelize,
    options: CachedDataSourceOptions,
  ) {
    super(childDataSource, SyncCollectionDecorator);

    this.connection = connection;
    this.options = options;
  }

  async start(): Promise<void> {
    const collections = this.collections.map(c => c.shortName);

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
    setTimeout(() => this.tick(), (this.options as DeltaOptions).accessDelay ?? 0);

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
      await this.getModel(collection.shortName).destroy({ truncate: true });
    }

    // Fill table with dump
    while (more) {
      const changes = await (this.options as DumpOptions).getDump({
        reasons: queue.reasons,
        collections: [...new Set(queue.reasons.flatMap(r => r.collections))],
        cache: new RelaxedDataSource(this, null),
        previousDumpState: state,
      });

      const recordsByCollection = {} as Record<string, RecordData[]>;

      for (const entry of changes.entries) {
        if (!recordsByCollection[entry.collection]) recordsByCollection[entry.collection] = [];
        recordsByCollection[entry.collection].push(entry.record);
      }

      for (const [collection, records] of Object.entries(recordsByCollection))
        await this.getModel(collection).bulkCreate(records);

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
      const changes = await (this.options as DeltaOptions).getDelta({
        reasons: queue.reasons,
        collections: [...new Set(queue.reasons.flatMap(r => r.collections))],
        cache: new RelaxedDataSource(this, null),
        previousDeltaState: previousState,
      });

      for (const entry of changes.newOrUpdatedEntries)
        await this.getModel(entry.collection).upsert(entry.record);
      for (const entry of changes.deletedEntries)
        await this.getModel(entry.collection).destroy({ where: entry.record });

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
    const stateRecord = await stateModel.findByPk(this.options.namespace);

    return stateRecord ? JSON.parse(stateRecord.dataValues.state) : null;
  }

  private async setDeltaState(state: unknown): Promise<void> {
    const stateModel = this.connection.model(`forest_sync_state`);
    await stateModel.upsert({ id: this.options.namespace, state: JSON.stringify(state) });
  }

  private getModel(shortName: string): ModelStatic<Model> {
    return this.connection.model(`${this.options.namespace}_${shortName}`);
  }
}
