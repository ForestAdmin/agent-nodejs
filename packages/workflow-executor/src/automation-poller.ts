import type {
  ServerAutomatedInboxAssignment,
  ServerAutomatedInboxConfig,
} from './adapters/server-types';
import type { AutomationPort } from './ports/automation-port';
import type { Logger } from './ports/logger-port';
import type { SegmentReaderPort } from './ports/segment-reader-port';

import createConsoleLogger from './adapters/console-logger';
import { DEFAULT_STOP_TIMEOUT_S } from './defaults';
import { AutomatedInboxGoneError, extractErrorMessage } from './errors';
import InFlightRunRegistry from './in-flight-run-registry';

// One membership question per chunk, small enough that a `pk In (...)` stays a query an agent will
// accept whatever its datasource.
const MEMBERSHIP_CHUNK_SIZE = 50;

const RECONCILABLE_ASSIGNMENT_STATES: ReadonlySet<string> = new Set([
  'done',
  'canceled',
  'auto-canceled',
]);

const TERMINAL_RUN_STATES: ReadonlySet<string> = new Set(['finished', 'aborted']);

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

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
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
  private pollingTimer: NodeJS.Timeout | null = null;
  private _state: AutomationPollerState = 'idle';

  constructor(config: AutomationPollerConfig) {
    this.config = config;
    this.logger = config.logger ?? createConsoleLogger();
  }

  get state(): AutomationPollerState {
    return this._state;
  }

  start(): void {
    if (this._state === 'stopped' || this._state === 'draining') {
      throw new Error('AutomationPoller has been stopped and cannot be restarted');
    }

    if (this._state === 'running') return;

    this._state = 'running';
    this.logger('Info', 'Automation poller started', {
      instanceId: this.config.instanceId,
      pollingIntervalS: this.config.pollingIntervalS,
    });
    this.schedulePoll();
  }

  async stop(): Promise<void> {
    if (this._state !== 'running') return;

    this._state = 'draining';

    if (this.pollingTimer !== null) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    try {
      if (this.inFlightInboxes.size > 0) {
        const timeoutS = this.config.stopTimeoutS ?? DEFAULT_STOP_TIMEOUT_S;
        let drainTimer: NodeJS.Timeout | undefined;

        const outcome = await Promise.race([
          this.inFlightInboxes.drain().then(() => {
            if (drainTimer) clearTimeout(drainTimer);

            return 'drained' as const;
          }),
          new Promise<'timeout'>(resolve => {
            drainTimer = setTimeout(() => resolve('timeout'), timeoutS * 1000);
          }),
        ]);

        if (outcome === 'timeout') {
          this.logger('Error', 'Automation poller drain timeout', {
            remainingInboxes: this.inFlightInboxes.keys(),
            timeoutS,
          });
        }
      }
    } finally {
      this._state = 'stopped';
      this.logger('Info', 'Automation poller stopped', {});
    }
  }

  private schedulePoll(): void {
    if (this._state !== 'running') return;
    this.pollingTimer = setTimeout(() => this.runPollCycle(), this.config.pollingIntervalS * 1000);
    // A background sweep must not be the reason a process stays alive: the host owns that, and an
    // interval this long would otherwise hold a shutdown open for minutes.
    this.pollingTimer.unref?.();
  }

  private async runPollCycle(): Promise<void> {
    try {
      const inboxes = await this.config.automationPort.listAutomatedInboxes(this.config.instanceId);

      // Also what a non-holder of the poller lease is served, so it reads as standing by rather
      // than as an environment with nothing configured.
      if (inboxes.length === 0) {
        this.logger('Debug', 'No automated inbox to poll', { instanceId: this.config.instanceId });

        return;
      }

      const pollable = inboxes.filter(({ inboxId }) => !this.inFlightInboxes.has(inboxId));

      this.logger('Debug', 'Automation poll cycle started', {
        fetched: inboxes.length,
        polling: pollable.length,
      });

      await Promise.all(
        pollable.map(config => this.inFlightInboxes.track(config.inboxId, this.pollInbox(config))),
      );
    } catch (error) {
      this.logger('Error', 'Automation poll cycle failed', {
        instanceId: this.config.instanceId,
        error: extractErrorMessage(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      this.schedulePoll();
    }
  }

  private async pollInbox(config: ServerAutomatedInboxConfig): Promise<void> {
    const logContext = {
      inboxId: config.inboxId,
      renderingId: config.renderingId,
      workflowId: config.workflowId,
      collectionName: config.collectionName,
    };

    try {
      const assignments = await this.config.automationPort.listAssignments(config.inboxId);
      const closed = await this.reconcileClosed(config, assignments);
      const candidates = await this.readCandidates(config, assignments);

      // Sent even when both lists are empty: this call is what tells the orchestrator the inbox is
      // still being polled, and an inbox with nothing to do must not read as an inbox nobody polls.
      const results = await this.config.automationPort.sync(config.inboxId, { closed, candidates });

      this.logger('Info', 'Automated inbox polled', {
        ...logContext,
        assignments: assignments.length,
        reconciled: closed.length,
        candidates: candidates.length,
        outcomes: results.reduce<Record<string, number>>(
          (counts, { outcome }) => ({ ...counts, [outcome]: (counts[outcome] ?? 0) + 1 }),
          {},
        ),
      });
    } catch (error) {
      // The orchestrator refuses this inbox for now — disabled, or degraded. The next config poll
      // decides whether it comes back, so this is not an error.
      if (error instanceof AutomatedInboxGoneError) {
        this.logger('Info', 'Automated inbox no longer served, dropping it for this cycle', {
          ...logContext,
        });

        return;
      }

      this.logger('Error', 'Automated inbox poll failed', {
        ...logContext,
        error: extractErrorMessage(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * A record whose run is over is only treated once it has left the segment. Reading the assignment
   * state alone is not enough: an escalation closes the automation's assignment while its run is
   * still going, and reporting that record would hand a live run to a human a second time.
   */
  private async reconcileClosed(
    config: ServerAutomatedInboxConfig,
    assignments: ServerAutomatedInboxAssignment[],
  ): Promise<{ recordId: string; stillInSegment: boolean }[]> {
    const recordIds = assignments
      .filter(
        ({ state, runState }) =>
          RECONCILABLE_ASSIGNMENT_STATES.has(state) &&
          runState !== null &&
          TERMINAL_RUN_STATES.has(runState),
      )
      .map(({ recordId }) => recordId);

    if (recordIds.length === 0) return [];

    const stillInSegment = new Set<string>();

    for (const batch of chunk(recordIds, MEMBERSHIP_CHUNK_SIZE)) {
      // eslint-disable-next-line no-await-in-loop
      const found = await this.config.segmentReaderPort.listRecordIds({
        ...AutomationPoller.segmentQuery(config),
        recordIds: batch,
        pageSize: batch.length,
      });

      found.forEach(recordId => stillInSegment.add(recordId));
    }

    return recordIds.map(recordId => ({
      recordId,
      stillInSegment: stillInSegment.has(recordId),
    }));
  }

  private async readCandidates(
    config: ServerAutomatedInboxConfig,
    assignments: ServerAutomatedInboxAssignment[],
  ): Promise<string[]> {
    // The assigned records sit at the front of the same segment page, so the window has to cover
    // them before it can hold a full batch of new ones.
    const page = await this.config.segmentReaderPort.listRecordIds({
      ...AutomationPoller.segmentQuery(config),
      pageSize: config.maxConcurrentRuns + assignments.length,
    });

    const known = new Set(assignments.map(({ recordId }) => recordId));

    return page.filter(recordId => !known.has(recordId));
  }

  private static segmentQuery(config: ServerAutomatedInboxConfig) {
    return {
      collectionName: config.collectionName,
      segment: config.segment,
      primaryKeys: config.primaryKeys,
      user: config.serviceAccountProfile,
      // Every executor instance must read a relative date the same way, so the machine's zone is
      // never the fallback.
      timezone: config.timezone ?? 'UTC',
    };
  }
}
