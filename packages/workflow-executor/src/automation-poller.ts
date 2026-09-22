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

const OPEN_ASSIGNMENT_STATES: ReadonlySet<string> = new Set(['todo', 'doing']);

const isTerminalRun = (runState: string | null | undefined): boolean =>
  runState != null && TERMINAL_RUN_STATES.has(runState);

const isLiveRun = (runState: string | null | undefined): boolean =>
  runState != null && LIVE_RUN_STATES.has(runState);

export type AutomationPollerState = 'idle' | 'running' | 'draining' | 'stopped';

/**
 * `skipped` is a read that had nothing to ask and so never reached the agent. It is not a
 * failure, and it is not proof the agent answers either — which is the distinction the sync
 * decision rests on.
 */
interface SegmentRead<T> {
  outcome: 'ok' | 'failed' | 'skipped';
  items: T[];
}

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

      // `stop()` may have run while that call was out. Dispatching now would read the customer's
      // agent and start runs during a shutdown that is only waiting on this cycle to end.
      if (this._state !== 'running') return;

      // An empty list is also what a non-holder of the poller lease is served, so it reads as
      // standing by rather than as an environment with nothing configured.
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
        this.tryRead(logContext, 'closed records', () => this.reconcileClosed(config, assignments)),
        this.tryRead(logContext, 'new candidates', () => this.readCandidates(config, assignments)),
      ]);

      // Reaching the agent at all is what the sync attests to. Reporting an empty poll when every
      // read failed would tell the orchestrator this inbox is being swept while nothing is, which
      // is the one thing a "no sync received" alert must never be lied to about. A read that
      // legitimately had nothing to ask is a success, not a failure.
      if (closed.outcome !== 'ok' && candidates.outcome !== 'ok') {
        this.logger('Error', 'Could not reach the agent, reporting nothing for this inbox', {
          ...logContext,
        });

        return;
      }

      // Sent even when both lists are empty: this call is what tells the orchestrator the inbox is
      // still being polled, and an inbox with nothing to do must not read as an inbox nobody polls.
      const results = await this.config.automationPort.sync(config.inboxId, {
        closed: closed.items,
        candidates: candidates.items,
      });

      this.logger('Info', 'Automated inbox polled', {
        ...logContext,
        assignments: assignments.length,
        reconciled: closed.items.length,
        candidates: candidates.items.length,
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
  ): Promise<SegmentRead<{ recordId: string; stillInSegment: boolean }>> {
    const logContext = { inboxId: config.inboxId, renderingId: config.renderingId };

    for (const { state } of assignments) {
      if (!RECONCILABLE_ASSIGNMENT_STATES.has(state) && !OPEN_ASSIGNMENT_STATES.has(state)) {
        this.logger('Warn', 'Unknown assignment state, leaving the record for a later poll', {
          ...logContext,
          state,
        });
      }
    }

    const reconcilable = assignments.filter(({ state }) =>
      RECONCILABLE_ASSIGNMENT_STATES.has(state),
    );

    for (const { runState } of reconcilable) {
      // Null belongs here too: the orchestrator binds the run before the assignment, so an
      // assignment with no run is not a shape this executor knows how to read either.
      if (!isTerminalRun(runState) && !isLiveRun(runState)) {
        this.logger('Warn', 'Unexpected workflow run state, leaving the record for a later poll', {
          ...logContext,
          runState,
        });
      }
    }

    // A closed assignment whose run is still going is an escalation in progress, and reporting it
    // would hand a live run to a human twice.
    const recordIds = [
      ...new Set(
        reconcilable.filter(({ runState }) => isTerminalRun(runState)).map(a => a.recordId),
      ),
    ];

    if (recordIds.length === 0) return { outcome: 'skipped', items: [] };

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

    return {
      outcome: 'ok',
      items: recordIds.map(recordId => ({
        recordId,
        stillInSegment: stillInSegment.has(recordId),
      })),
    };
  }

  /**
   * Runs one of the two segment reads. A failure yields an empty list rather than ending the poll,
   * so the other read and the sync still happen — but it is reported as a failure, because "read
   * nothing" and "could not read" must not look alike to the caller.
   */
  private async tryRead<T>(
    logContext: Record<string, unknown>,
    what: string,
    read: () => Promise<SegmentRead<T>>,
  ): Promise<SegmentRead<T>> {
    try {
      return await read();
    } catch (error) {
      this.logger('Error', `Could not read ${what} of an automated inbox`, {
        ...logContext,
        error: extractErrorMessage(error),
      });

      return { outcome: 'failed', items: [] };
    }
  }

  private async readCandidates(
    config: ServerAutomatedInboxConfig,
    assignments: ServerAutomatedInboxAssignment[],
  ): Promise<SegmentRead<string>> {
    // Sized so that the already-assigned records can fit inside the window alongside a full batch
    // of new ones. No sort is imposed and each agent orders as it likes, so this is a best effort,
    // not a guarantee: a page that comes back mostly assigned simply yields fewer candidates, and
    // the rest are picked up by a later poll.
    const page = await this.config.segmentReaderPort.listRecordIds({
      ...AutomationPoller.segmentQuery(config),
      pageSize: config.maxConcurrentRuns + assignments.length,
    });

    const known = new Set(assignments.map(({ recordId }) => recordId));

    return { outcome: 'ok', items: page.filter(recordId => !known.has(recordId)) };
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
