/* eslint-disable max-classes-per-file */
/* eslint-disable no-await-in-loop */
import RelaxedDataSource from '@forestadmin/datasource-customizer/dist/context/relaxed-wrappers/datasource';
import { Deferred } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';

import {
  CachedDataSourceOptions,
  PullDeltaReason,
  PullDumpReason,
  PushDeltaResponse,
  SynchronizationSource,
  SynchronizationTarget,
} from '../types';

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

export default class CustomerSource extends EventTarget implements SynchronizationSource {
  requestCache: RelaxedDataSource = null;

  private options: CachedDataSourceOptions;
  private connection: Sequelize;
  private isRunning = false;

  private queuedPullDumpReasons: Queue<PullDumpReason> = null;
  private queuedPullDeltaReasons: Queue<PullDeltaReason> = null;
  private queuedPushDeltaRequest: PushDeltaResponse = null;

  private timers: NodeJS.Timer[] = [];
  private target: SynchronizationTarget;

  constructor(connection: Sequelize, options: CachedDataSourceOptions) {
    super();
    this.connection = connection;
    this.options = options;

    const hasPullDeltaFlag =
      options.pullDeltaOnRestart ||
      options.pullDeltaOnTimer ||
      options.pullDeltaOnAfterWrite ||
      options.pullDeltaOnBeforeAccess;

    if (options.pullDeltaHandler && !hasPullDeltaFlag)
      throw new Error('Using pullDeltaHandler without pullDelta[*] flags');

    if (hasPullDeltaFlag && !options.pullDeltaHandler)
      throw new Error('Using pullDelta[*] flags without pullDeltaHandler');
  }

  async start(target: SynchronizationTarget): Promise<void> {
    if (this.target) throw new Error('Already started');
    this.target = target;

    if (
      this.options.pullDumpHandler &&
      (this.options.pullDumpOnRestart || (await this.getStartupState()) !== 'done')
    )
      await this.queuePullDump({ name: 'startup', collections: [] });

    if (this.options.pullDeltaHandler && this.options.pullDeltaOnRestart)
      await this.queuePullDelta({ name: 'startup', collections: [] });

    if (this.options.pushDeltaHandler) {
      const previousDeltaState = await this.getDeltaState();
      this.options.pushDeltaHandler(
        { cache: this.requestCache, previousDeltaState },
        // fixme queuePushDelta is not returning a promise
        async changes => this.queuePushDelta(changes),
      );
    }

    if (this.options.pullDumpHandler && this.options.pullDumpOnTimer)
      this.timers.push(
        setInterval(
          () => this.queuePullDump({ name: 'timer', collections: [] }),
          this.options.pullDumpOnTimer,
        ),
      );

    if (this.options.pullDeltaHandler && this.options.pullDeltaOnTimer)
      this.timers.push(
        setInterval(
          () => this.queuePullDelta({ name: 'timer', collections: [] }),
          this.options.pullDeltaOnTimer,
        ),
      );
  }

  async stop(): Promise<void> {
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.length = 0;
  }

  private queuePushDelta(delta: PushDeltaResponse): void {
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

    this.target.applyDelta(changes);

    this.isRunning = false;
    this.tick();
  }

  private async runPullDump(queue: Queue<PullDumpReason>): Promise<void> {
    this.isRunning = true;

    let state = null;
    let more = true;
    let firstPage = true;

    await this.setStartupState('in_progress');

    // Fill table with dump
    while (more) {
      const changes = await this.options.pullDumpHandler({
        reasons: queue.reasons,
        collections: [...new Set(queue.reasons.flatMap(r => r.collections))],
        cache: this.requestCache,
        previousDumpState: state,
      });

      this.target.applyDump(changes, firstPage);
      firstPage = false;

      more = changes.more;
      if (changes.more === true) state = changes.nextDumpState;
      if (changes.more === false && changes.nextDeltaState)
        await this.setDeltaState(changes.nextDeltaState);
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
      const changes = await this.options.pullDeltaHandler({
        reasons: queue.reasons,
        collections: [...new Set(queue.reasons.flatMap(r => r.collections))],
        cache: this.requestCache,
        previousDeltaState: previousState,
      });

      await this.target.applyDelta(changes);
      more = changes.more;
    }

    this.isRunning = false;
    queue.deferred.resolve();
    this.tick();
  }

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
