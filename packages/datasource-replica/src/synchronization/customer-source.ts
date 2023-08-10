import type CacheDataSourceInterface from '../cache-interface/datasource';
import type {
  PullDeltaReason,
  PullDumpReason,
  PushDeltaResponse,
  ReplicaDataSourceOptions,
  SynchronizationSource,
  SynchronizationTarget,
} from '../types';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { Sequelize } from 'sequelize';

import { Deferred } from '@forestadmin/datasource-toolkit';
import { Cron } from 'croner';

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

export default class CustomerSource implements SynchronizationSource {
  requestCache: CacheDataSourceInterface = null;

  private readonly logger: Logger;

  private options: ReplicaDataSourceOptions;
  private connection: Sequelize;
  private isRunning = false;

  private queuedPullDumpReasons: Queue<PullDumpReason> = null;
  private queuedPullDeltaReasons: Queue<PullDeltaReason> = null;
  private queuedPushDeltaRequest: PushDeltaResponse = null;

  private schedules: Cron[] = [];
  private target: SynchronizationTarget;

  constructor(connection: Sequelize, options: ReplicaDataSourceOptions, logger: Logger) {
    this.connection = connection;
    this.options = options;
    this.logger = logger;

    const hasPullDeltaFlag =
      options.pullDeltaOnRestart ||
      options.pullDeltaOnSchedule ||
      options.pullDeltaOnAfterWrite ||
      options.pullDeltaOnBeforeAccess;

    if (options.pullDeltaHandler && !hasPullDeltaFlag)
      throw new Error('Using pullDeltaHandler without pullDelta[*] flags');

    if (hasPullDeltaFlag && !options.pullDeltaHandler)
      throw new Error('Using pullDelta[*] flags without pullDeltaHandler');
  }

  async start(target: SynchronizationTarget): Promise<void> {
    const { options } = this;

    if (this.target) throw new Error('Already started');
    this.target = target;

    if (
      options.pullDumpHandler &&
      (options.pullDumpOnRestart || (await this.getStartupState()) !== 'done')
    )
      await this.queuePullDump({ name: 'startup' });

    if (options.pullDeltaHandler && options.pullDeltaOnRestart)
      await this.queuePullDelta({ name: 'startup' });

    if (options.pushDeltaHandler) {
      options.pushDeltaHandler(
        { cache: this.requestCache, getPreviousDeltaState: () => this.getDeltaState() },
        async changes => this.queuePushDelta(changes),
      );
    }

    if (options.pullDumpHandler && options.pullDumpOnSchedule) {
      const schedule = options.pullDumpOnSchedule;

      for (const pattern of Array.isArray(schedule) ? schedule : [schedule]) {
        this.schedules.push(Cron(pattern, () => this.queuePullDump({ name: 'schedule' })));
      }
    }

    if (options.pullDeltaHandler && options.pullDeltaOnSchedule) {
      const schedule = options.pullDeltaOnSchedule;

      for (const pattern of Array.isArray(schedule) ? schedule : [schedule]) {
        this.schedules.push(Cron(pattern, () => this.queuePullDelta({ name: 'schedule' })));
      }
    }
  }

  async stop(): Promise<void> {
    this.schedules.forEach(cron => cron.stop());
    this.schedules.length = 0;
  }

  private queuePushDelta(delta: PushDeltaResponse): void {
    if (!this.queuedPushDeltaRequest)
      this.queuedPushDeltaRequest = { newOrUpdatedEntries: [], deletedEntries: [] };

    this.queuedPushDeltaRequest.deletedEntries.push(...delta.deletedEntries);
    this.queuedPushDeltaRequest.newOrUpdatedEntries.push(...delta.newOrUpdatedEntries);
    if (delta.nextDeltaState) this.queuedPushDeltaRequest.nextDeltaState = delta.nextDeltaState;
    this.tick();
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

    await this.target.applyDelta(changes);

    this.isRunning = false;
    this.tick();
  }

  /* eslint-disable no-await-in-loop */
  private async runPullDump(queue: Queue<PullDumpReason>): Promise<void> {
    this.isRunning = true;

    let state = null;
    let more = true;
    let firstPage = true;

    await this.setStartupState('in_progress');

    // Fill table with dump
    while (more) {
      try {
        const changes = await this.options.pullDumpHandler({
          reasons: queue.reasons,
          cache: this.requestCache,
          previousDumpState: state,
        });

        await this.target.applyDump(changes, firstPage);
        firstPage = false;

        more = changes.more;
        if (changes.more === true) state = changes.nextDumpState;
        if (changes.more === false && changes.nextDeltaState)
          await this.setDeltaState(changes.nextDeltaState);
      } catch (error) {
        more = false;
        this.logger(
          'Warn',
          `Dump failed for the namespace "${this.options.cacheNamespace}": ${error.message}`,
        );
      }
    }

    await this.setStartupState('done');
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
      const collections = queue.reasons.flatMap(r =>
        'affectedCollections' in r ? r.affectedCollections : [],
      );

      try {
        const changes = await this.options.pullDeltaHandler({
          reasons: queue.reasons,
          affectedCollections: [...new Set(collections)],
          cache: this.requestCache,
          previousDeltaState: previousState,
        });
        await this.target.applyDelta(changes);
        await this.setDeltaState(changes.nextDeltaState);
        more = changes.more;
      } catch (error) {
        more = false;
        this.logger(
          'Warn',
          `Delta failed for the namespace "${this.options.cacheNamespace}": ${error.message}`,
        );
      }
    }

    this.isRunning = false;
    queue.deferred.resolve();
    this.tick();
  }
  /* eslint-enable no-await-in-loop */

  private async getStartupState(): Promise<'pending' | 'in_progress' | 'done'> {
    const metadataModel = this.connection.model(`${this.options.cacheNamespace}_metadata`);
    const stateRecord = await metadataModel.findByPk('statup_state');

    return stateRecord ? JSON.parse(stateRecord.dataValues.content) : 'pending';
  }

  private async setStartupState(state: 'pending' | 'in_progress' | 'done'): Promise<void> {
    const metadataModel = this.connection.model(`${this.options.cacheNamespace}_metadata`);
    await metadataModel.upsert({ id: 'statup_state', content: JSON.stringify(state) });
  }

  private async getDeltaState(): Promise<unknown> {
    const metadataModel = this.connection.model(`${this.options.cacheNamespace}_metadata`);
    const stateRecord = await metadataModel.findByPk('delta_state');

    return stateRecord ? JSON.parse(stateRecord.dataValues.content) : null;
  }

  private async setDeltaState(state: unknown): Promise<void> {
    const metadataModel = this.connection.model(`${this.options.cacheNamespace}_metadata`);
    await metadataModel.upsert({ id: 'delta_state', content: JSON.stringify(state) });
  }
}
