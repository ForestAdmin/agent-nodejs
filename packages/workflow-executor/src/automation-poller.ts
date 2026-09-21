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

const LIVE_RUN_STATES: ReadonlySet<string> = new Set(['started', 'pending', 'loading']);

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
  // The cycle itself, not just the inbox polls it spawns: a cycle still waiting on the config route
  // has registered nothing, and draining only the registry would let it read and write after the
  // host was told the poller had stopped.
  private currentCycle: Promise<void> | null = null;
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
      const timeoutS = this.config.stopTimeoutS ?? DEFAULT_STOP_TIMEOUT_S;
      let drainTimer: NodeJS.Timeout | undefined;

      const outcome = await Promise.race([
        Promise.allSettled([this.currentCycle, this.inFlightInboxes.drain()]).then(() => {
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

  private schedulePoll(): void {
    if (this._state !== 'running') return;
    this.pollingTimer = setTimeout(() => {
      this.currentCycle = this.runPollCycle();
    }, this.config.pollingIntervalS * 1000);
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

      this.logger('Debug', 'Automation poll cycle started', { fetched: inboxes.length });

      // Awaited, so the next cycle is only scheduled once this one is done: a slow segment read
      // delays the sweep instead of stacking a second one on the customer's database. The registry
      // is what `stop()` drains, not a concurrency guard — there is nothing to guard against.
      await Promise.all(
        inboxes.map(config => this.inFlightInboxes.track(config.inboxId, this.pollInbox(config))),
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

      // Read independently, and neither is allowed to cost the other. Losing the reconciliation
      // because the candidate page timed out would leave those assignments open, which makes the
      // next page larger, which makes the next timeout likelier.
      const [closed, candidates] = await Promise.all([
        this.readOrEmpty(logContext, 'closed records', () =>
          this.reconcileClosed(config, assignments),
        ),
        this.readOrEmpty(logContext, 'new candidates', () =>
          this.readCandidates(config, assignments),
        ),
      ]);

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
    const reconcilable = assignments.filter(({ state }) =>
      RECONCILABLE_ASSIGNMENT_STATES.has(state),
    );

    for (const { runState } of reconcilable) {
      if (
        runState != null &&
        !TERMINAL_RUN_STATES.has(runState) &&
        !LIVE_RUN_STATES.has(runState)
      ) {
        this.logger('Warn', 'Unknown workflow run state, leaving the record for a later poll', {
          inboxId: config.inboxId,
          renderingId: config.renderingId,
          runState,
        });
      }
    }

    // A closed assignment whose run is still going is an escalation in progress, and reporting it
    // would hand a live run to a human twice. A closed assignment with no run at all is the
    // opposite case: there is nothing to protect, so it reconciles like any other.
    const recordIds = [
      ...new Set(
        reconcilable
          .filter(({ runState }) => runState == null || TERMINAL_RUN_STATES.has(runState))
          .map(({ recordId }) => recordId),
      ),
    ];

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

  /**
   * Runs one of the two segment reads, turning a failure into an empty list. The other read, and the
   * sync that carries both, still happen: an inbox that loses one of them must still make progress.
   */
  private async readOrEmpty<T>(
    logContext: Record<string, unknown>,
    what: string,
    read: () => Promise<T[]>,
  ): Promise<T[]> {
    try {
      return await read();
    } catch (error) {
      this.logger('Error', `Could not read ${what} of an automated inbox`, {
        ...logContext,
        error: extractErrorMessage(error),
      });

      return [];
    }
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
