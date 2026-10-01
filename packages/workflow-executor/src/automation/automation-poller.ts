import type { AutomationPort } from '../ports/automation-port';
import type { Logger } from '../ports/logger-port';
import type { SegmentReaderPort } from '../ports/segment-reader-port';

import InboxPoll from './inbox-poll';
import LeaseKeeper from './lease-keeper';
import createConsoleLogger from '../adapters/console-logger';
import { DEFAULT_STOP_TIMEOUT_S } from '../defaults';
import { extractErrorMessage } from '../errors';
import InFlightRunRegistry from '../in-flight-run-registry';

// Every inbox reads the customer's agent several times. Sweeping them all at once piles those reads
// onto the customer's database, and agent-client's ten-second timeout turns the pile-up into inboxes
// whose reads time out.
const MAX_CONCURRENT_INBOX_POLLS = 5;

// The orchestrator's poller lease lives three of these, so a dead holder is replaced within a
// minute. Kept apart from the sweep interval: a sweep can last longer than the lease.
const LEASE_HEARTBEAT_INTERVAL_S = 15;

export type AutomationPollerState = 'idle' | 'running' | 'draining' | 'stopped';

export interface AutomationPollerConfig {
  automationPort: AutomationPort;
  segmentReaderPort: SegmentReaderPort;
  pollingIntervalS: number;
  /**
   * Identifies this process to the orchestrator's single-poller election. Stable for the process's
   * lifetime, distinct across instances.
   */
  instanceId: string;
  logger?: Logger;
  stopTimeoutS?: number;
}

/**
 * Drives the automated inboxes of one environment: asks the orchestrator which ones to poll, reads
 * their segment on the client's agent, and reports back. It never decides what runs — the
 * orchestrator owns the concurrency cap, the active-run check and the run start.
 *
 * Kept apart from `Runner`: they share nothing but a polling shape, and a failure on one side must
 * not stop the other.
 */
export default class AutomationPoller {
  private readonly config: AutomationPollerConfig;
  private readonly logger: Logger;
  private readonly inFlightInboxes = new InFlightRunRegistry();
  private tickTimer: NodeJS.Timeout | null = null;
  private currentTick: Promise<void> | null = null;
  // The cycle itself, not just the inbox polls it spawns: a cycle still waiting on the config route
  // has registered nothing, and draining only the registry would let it read and write after the
  // host was told the poller had stopped.
  private currentCycle: Promise<void> | null = null;
  private readonly lease = new LeaseKeeper();
  private readonly inboxPoll: InboxPoll;
  private sweepCutShort = false;
  private nextSweepAt = 0;
  private _state: AutomationPollerState = 'idle';

  constructor(config: AutomationPollerConfig) {
    this.config = config;
    this.logger = config.logger ?? createConsoleLogger();
    this.inboxPoll = new InboxPoll({
      automationPort: config.automationPort,
      segmentReaderPort: config.segmentReaderPort,
      logger: this.logger,
    });
  }

  get state(): AutomationPollerState {
    return this._state;
  }

  start(): void {
    if (this._state === 'stopped' || this._state === 'draining') {
      throw new Error('AutomationPoller has been stopped and cannot be restarted');
    }

    if (this._state === 'running') return;

    // `AUTOMATION_POLL_INTERVAL_S=0` turns the sweep off. The poller stays constructed and `stop()`
    // still answers, so nothing downstream has to know an executor is running without it.
    if (this.config.pollingIntervalS === 0) {
      this.logger('Info', 'Automation poller disabled by configuration', {
        instanceId: this.config.instanceId,
      });

      return;
    }

    this._state = 'running';
    this.logger('Info', 'Automation poller started', {
      instanceId: this.config.instanceId,
      pollingIntervalS: this.config.pollingIntervalS,
    });
    this.scheduleTick(0);
  }

  async stop(): Promise<void> {
    if (this._state !== 'running') return;

    this._state = 'draining';

    if (this.tickTimer !== null) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }

    try {
      const timeoutS = this.config.stopTimeoutS ?? DEFAULT_STOP_TIMEOUT_S;
      let drainTimer: NodeJS.Timeout | undefined;

      const outcome = await Promise.race([
        Promise.allSettled([
          this.currentTick,
          this.currentCycle,
          this.inFlightInboxes.drain(),
        ]).then(() => {
          if (drainTimer) clearTimeout(drainTimer);

          return 'drained' as const;
        }),
        new Promise<'timeout'>(resolve => {
          drainTimer = setTimeout(() => resolve('timeout'), timeoutS * 1000);
          // The bound on a shutdown wait must not itself become a reason to stay up.
          drainTimer.unref?.();
        }),
      ]);

      if (outcome === 'timeout') {
        this.logger('Error', 'Automation poller drain timeout', {
          remainingInboxes: this.inFlightInboxes.keys(),
          timeoutS,
        });
      }
    } finally {
      this._state = 'stopped';
      this.logger('Info', 'Automation poller stopped', {});
    }
  }

  private scheduleTick(delayMs: number): void {
    if (this._state !== 'running') return;
    this.tickTimer = setTimeout(() => {
      this.currentTick = this.tick();
    }, delayMs);
    // A background heartbeat must not be the reason a process stays alive: the host owns that.
    this.tickTimer.unref?.();
  }

  private async tick(): Promise<void> {
    try {
      const held = await this.config.automationPort.holdLease(this.config.instanceId);

      if (this._state !== 'running') return;

      if (this.lease.record(held, Date.now())) {
        this.logger(
          'Info',
          held
            ? 'Holding the automation poller lease, this instance sweeps the automated inboxes'
            : 'Standing by, another instance sweeps the automated inboxes',
          { instanceId: this.config.instanceId },
        );
      }

      if (!held) {
        this.nextSweepAt = 0;

        return;
      }

      if (this.currentCycle === null && Date.now() >= this.nextSweepAt) {
        this.sweepCutShort = false;
        // Not awaited: the heartbeat has to keep the lease through a sweep that outlasts it.
        this.currentCycle = this.runPollCycle().finally(() => {
          this.currentCycle = null;
          // The inboxes a lost lease left undispatched are owed as soon as the lease is back.
          this.nextSweepAt = this.sweepCutShort
            ? 0
            : Date.now() + this.config.pollingIntervalS * 1000;
        });
      }
    } catch (error) {
      this.logger('Error', 'Automation poller lease heartbeat failed', {
        instanceId: this.config.instanceId,
        error: extractErrorMessage(error),
      });

      if (this.lease.recordFailure(Date.now())) {
        this.logger('Warn', 'No heartbeat landed for too long, standing by until one does', {
          instanceId: this.config.instanceId,
        });
        this.nextSweepAt = 0;
      }
    } finally {
      this.scheduleTick(LEASE_HEARTBEAT_INTERVAL_S * 1000);
    }
  }

  private async runPollCycle(): Promise<void> {
    try {
      const inboxes = await this.config.automationPort.listAutomatedInboxes(this.config.instanceId);

      // `stop()` may have run while that call was out. Dispatching now would read the customer's
      // agent and start runs during a shutdown that is only waiting on this cycle to end.
      if (this._state !== 'running') return;

      if (inboxes.length === 0) {
        this.logger('Debug', 'No automated inbox to poll', { instanceId: this.config.instanceId });

        return;
      }

      this.logger('Debug', 'Automation poll cycle started', { fetched: inboxes.length });

      // Awaited, so no other cycle starts before this one is done: a slow segment read delays the
      // sweep instead of stacking a second one on the customer's database. The registry is what
      // `stop()` drains.
      const queue = [...inboxes];

      const sweepQueue = async (): Promise<void> => {
        let config = queue.shift();

        // A lost lease means another instance may already be sweeping these inboxes.
        while (config && this._state === 'running' && this.lease.isTrusted(Date.now())) {
          // eslint-disable-next-line no-await-in-loop
          await this.inFlightInboxes.track(config.inboxId, this.inboxPoll.poll(config));
          config = queue.shift();
        }

        if (config && this._state === 'running') this.sweepCutShort = true;
      };

      await Promise.all(
        Array.from({ length: Math.min(MAX_CONCURRENT_INBOX_POLLS, queue.length) }, sweepQueue),
      );
    } catch (error) {
      this.logger('Error', 'Automation poll cycle failed', {
        instanceId: this.config.instanceId,
        error: extractErrorMessage(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }
}
