import type {
  ServerAutomatedInboxAssignment,
  ServerAutomatedInboxConfig,
  ServerAutomatedInboxReadFailure,
  ServerAutomatedInboxReadFailureReason,
} from './adapters/server-types';
import type { SegmentReadFailureKind } from './errors';
import type { AutomationPort } from './ports/automation-port';
import type { Logger } from './ports/logger-port';
import type { ExclusionUnavailableReason, SegmentReaderPort } from './ports/segment-reader-port';

import createConsoleLogger from './adapters/console-logger';
import toProjectTimezone from './adapters/project-timezone';
import { DEFAULT_STOP_TIMEOUT_S } from './defaults';
import { AutomatedInboxGoneError, SegmentReadError, extractErrorMessage } from './errors';
import InFlightRunRegistry from './in-flight-run-registry';
import { deserializeRecordId } from './record-id';

// One membership question per chunk, small enough that a `pk In (...)` stays a query an agent will
// accept whatever its datasource.
const MEMBERSHIP_CHUNK_SIZE = 50;

// Ceiling on the padded fallback page. The padding grows with the backlog while the agent read is
// bounded by the client's ten-second timeout, so past some size the page stops being served at all.
const MAX_CANDIDATE_PAGE_SIZE = 500;

// Records waiting on a person stay known for as long as nobody handles them, so one padded page can
// hold nothing but them. Bounds the reads a sweep makes on the customer's agent to walk past them.
const MAX_PADDED_PAGES = 5;

// Every inbox reads the customer's agent several times. Sweeping them all at once piles those reads
// onto the customer's database, and agent-client's ten-second timeout turns the pile-up into inboxes
// whose reads time out.
const MAX_CONCURRENT_INBOX_POLLS = 5;

// The orchestrator's poller lease lives three of these, so a dead holder is replaced within a
// minute. Kept apart from the sweep interval: a sweep can last longer than the lease.
const LEASE_HEARTBEAT_INTERVAL_S = 15;

// Past this without a confirmed beat, the lease may have expired and gone to another instance.
// Judged at each dispatch rather than when a beat fails: a timed-out beat only fails 5 s late, and
// the next one 15 s after that, which would land past the 45 s lease.
const LEASE_TRUSTED_FOR_MS = 30_000;

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

const READ_FAILURE_REASONS: Record<SegmentReadFailureKind, ServerAutomatedInboxReadFailureReason> =
  {
    forbidden: 'agent-forbidden',
    unreachable: 'agent-unreachable',
    overloaded: 'segment-read-failed',
    failed: 'segment-read-failed',
  };

function classifyReadFailure(error: unknown): ServerAutomatedInboxReadFailure {
  if (!(error instanceof SegmentReadError)) return { reason: 'segment-read-failed' };

  const { failure, httpStatus } = error;
  const reason = READ_FAILURE_REASONS[failure];

  return httpStatus === undefined ? { reason } : { reason, httpStatus };
}

// A refused `not_in` comes back as a 4xx or a 500 depending on the agent (PHP answers 500 even for
// an undeclared operator). Only a timeout, an unreachable agent or a throttle rules it out, and
// padding then would evaluate the segment again on top of the read the agent may still be running.
// A 401 or 403 would refuse the padded read just the same.
function mayBeOperatorRefusal(error: unknown): boolean {
  return !(error instanceof SegmentReadError) || error.failure === 'failed';
}

function describeAgentFailure(error: unknown) {
  return {
    error: extractErrorMessage(error),
    httpStatus: classifyReadFailure(error).httpStatus,
    agentError: error instanceof SegmentReadError ? error.agentDetail : undefined,
  };
}

export type AutomationPollerState = 'idle' | 'running' | 'draining' | 'stopped';

type PaddedPageReason = ExclusionUnavailableReason | 'capabilities-unreadable' | 'not-in-refused';

interface SegmentRead<T> {
  items: T[];
  paddedPageReason?: PaddedPageReason;
  requestedPageSize?: number;
  pagesRead?: number;
  failure?: ServerAutomatedInboxReadFailure;
}

interface ReadAttempt {
  membershipChunk?: number;
  membershipChunks?: number;
  requestedPageSize?: number;
  pageNumber?: number;
  paddedPageReason?: PaddedPageReason;
  notIn?: boolean;
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
  private tickTimer: NodeJS.Timeout | null = null;
  private currentTick: Promise<void> | null = null;
  // The cycle itself, not just the inbox polls it spawns: a cycle still waiting on the config route
  // has registered nothing, and draining only the registry would let it read and write after the
  // host was told the poller had stopped.
  private currentCycle: Promise<void> | null = null;
  private holdsLease: boolean | undefined;
  private leaseConfirmedAt = 0;
  private sweepCutShort = false;
  private nextSweepAt = 0;
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

      if (held !== this.holdsLease) {
        this.logger(
          'Info',
          held
            ? 'Holding the automation poller lease, this instance sweeps the automated inboxes'
            : 'Standing by, another instance sweeps the automated inboxes',
          { instanceId: this.config.instanceId },
        );
      }

      this.holdsLease = held;

      if (held) this.leaseConfirmedAt = Date.now();

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

      if (this.holdsLease && Date.now() - this.leaseConfirmedAt >= LEASE_TRUSTED_FOR_MS) {
        this.logger('Warn', 'No heartbeat landed for too long, standing by until one does', {
          instanceId: this.config.instanceId,
        });
        this.holdsLease = false;
        this.nextSweepAt = 0;
      }
    } finally {
      this.scheduleTick(LEASE_HEARTBEAT_INTERVAL_S * 1000);
    }
  }

  private leaseIsTrusted(): boolean {
    return this.holdsLease === true && Date.now() - this.leaseConfirmedAt < LEASE_TRUSTED_FOR_MS;
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
        while (config && this._state === 'running' && this.leaseIsTrusted()) {
          // eslint-disable-next-line no-await-in-loop
          await this.inFlightInboxes.track(config.inboxId, this.pollInbox(config));
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
        this.tryRead(logContext, 'closed records', attempt =>
          this.reconcileClosed(config, assignments, attempt),
        ),
        this.tryRead(logContext, 'new candidates', attempt =>
          this.readCandidates(logContext, config, assignments, attempt),
        ),
      ]);

      // The candidate read is the one that starts runs, so its failure is the one worth fixing.
      const readFailure = candidates.failure ?? closed.failure;

      // Sent even when both lists are empty or both reads failed: the orchestrator keeps the last
      // read failure until a sync comes without one, so a skipped sync would leave the settings
      // panel with a stale warning, or none at all.
      const results = await this.config.automationPort.sync(config.inboxId, {
        closed: closed.items,
        candidates: candidates.items,
        readFailure,
      });

      this.logger('Info', 'Automated inbox polled', {
        ...logContext,
        assignments: assignments.length,
        reconciled: closed.items.length,
        candidates: candidates.items.length,
        candidatePageSize: candidates.requestedPageSize,
        candidatePagesRead: candidates.pagesRead,
        paddedPageReason: candidates.paddedPageReason,
        readFailure: readFailure?.reason,
        outcomes: results.reduce<Record<string, number>>(
          (counts, { outcome }) => ({ ...counts, [outcome]: (counts[outcome] ?? 0) + 1 }),
          {},
        ),
      });
    } catch (error) {
      // Legitimate only if the inbox was disabled or degraded since this cycle's listing served it.
      // Otherwise its route is missing behind a proxy, a path prefix or a version skew, and the inbox
      // is never swept again.
      if (error instanceof AutomatedInboxGoneError) {
        this.logger(
          'Warn',
          'Automated inbox listed this cycle but its route answered 404, dropping it for this cycle',
          { ...logContext, operation: error.operation, detail: error.detail },
        );

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
   * state alone is not enough: a record reported still in the segment while its run is going would
   * be judged untreated before the run had a chance to take it out.
   */
  private async reconcileClosed(
    config: ServerAutomatedInboxConfig,
    assignments: ServerAutomatedInboxAssignment[],
    attempt: ReadAttempt,
  ): Promise<SegmentRead<{ recordId: string; stillInSegment: boolean }>> {
    const logContext = { inboxId: config.inboxId, renderingId: config.renderingId };

    for (const { state, recordId, workflowRunId } of assignments) {
      if (!RECONCILABLE_ASSIGNMENT_STATES.has(state) && !OPEN_ASSIGNMENT_STATES.has(state)) {
        this.logger(
          'Warn',
          'Unknown assignment state, leaving the record out of every sweep until this executor knows it',
          {
            ...logContext,
            state,
            recordId,
            workflowRunId,
          },
        );
      }
    }

    // The orchestrator keeps the row of an ended run `doing` while its record is still in the
    // segment, so that record is only released once it is seen leaving. An assignment with no
    // workflowRunId was made by a person, not the orchestrator, which binds the run first: there is
    // nothing to reconcile, so it stays out of the report — the record stays known, and no automated
    // run is ever started over the human's work. Keyed on the run's presence, not its state: the
    // orchestrator binds a run before an automated assignment and its `runState` is NOT NULL, so a
    // bound run with a null state is a contract break, not a human assignment — it belongs here so
    // the warning below surfaces it instead of dropping it silently.
    const reconcilable = assignments.filter(
      ({ state, runState, workflowRunId }) =>
        workflowRunId != null &&
        (RECONCILABLE_ASSIGNMENT_STATES.has(state) ||
          (state === 'doing' && isTerminalRun(runState))),
    );

    for (const { runState, recordId, workflowRunId } of reconcilable) {
      // A run state this executor cannot place: a non-null one it predates, or null on a bound run —
      // which the orchestrator's schema (NOT NULL runState behind a cascading FK) should never emit,
      // so it is a contract break worth surfacing until a fix lands. The human assignment never
      // reaches here — it has no workflowRunId, so warning forever would be noise it could never
      // resolve.
      if (!isTerminalRun(runState) && !isLiveRun(runState)) {
        this.logger(
          'Warn',
          'Unexpected workflow run state, leaving the record out of every sweep until this executor knows it',
          {
            ...logContext,
            runState,
            recordId,
            workflowRunId,
          },
        );
      }
    }

    // A record whose run is still going is not judged yet, whatever its assignments say. Judged per
    // record rather than per assignment: nothing in the contract says a record holds only one, and
    // one terminal assignment must not speak for a sibling whose run is still alive.
    const liveRecords = new Set(
      assignments.filter(({ runState }) => !isTerminalRun(runState)).map(a => a.recordId),
    );
    const recordIds = [
      ...new Set(
        reconcilable
          .filter(({ recordId }) => !liveRecords.has(recordId))
          .map(({ recordId }) => recordId),
      ),
    ];

    // A packed id that does not split into as many parts as the key has columns cannot be asked
    // about — the agent has the same limitation in `IdUtils.packId`. Dropped one by one rather than
    // failing the chunk, which would end reconciliation for the whole inbox on every cycle, and
    // left out of the report entirely: telling the orchestrator it is not in the segment would
    // retire its assignment and let the record be launched again.
    const readable = recordIds.filter(recordId => {
      if (
        config.primaryKeys.length === 1 ||
        deserializeRecordId(recordId).length === config.primaryKeys.length
      ) {
        return true;
      }

      this.logger('Warn', 'Unreadable record id, leaving the record out of the reconciliation', {
        ...logContext,
        recordId,
        primaryKeyCount: config.primaryKeys.length,
      });

      return false;
    });

    if (readable.length === 0) return { items: [] };

    const stillInSegment = new Set<string>();
    const batches = chunk(readable, MEMBERSHIP_CHUNK_SIZE);

    for (const [index, batch] of batches.entries()) {
      Object.assign(attempt, { membershipChunk: index + 1, membershipChunks: batches.length });
      // eslint-disable-next-line no-await-in-loop
      const found = await this.config.segmentReaderPort.listRecordIds({
        ...AutomationPoller.segmentQuery(config),
        recordIds: batch,
        pageSize: batch.length,
      });

      found.forEach(recordId => stillInSegment.add(recordId));
    }

    return {
      items: readable.map(recordId => ({
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
    read: (attempt: ReadAttempt) => Promise<SegmentRead<T>>,
  ): Promise<SegmentRead<T>> {
    const attempt: ReadAttempt = {};

    try {
      return await read(attempt);
    } catch (error) {
      this.logger('Error', `Could not read ${what} of an automated inbox`, {
        ...logContext,
        ...attempt,
        ...describeAgentFailure(error),
      });

      return { items: [], failure: classifyReadFailure(error) };
    }
  }

  /**
   * Asks the agent for records the orchestrator has no assignment for. Excluding them in the query
   * is what keeps the page at the run cap: a record already treated but still in the segment stays
   * there for good, and left in the page it would take a slot on every poll from then on.
   */
  private async readCandidates(
    logContext: Record<string, unknown>,
    config: ServerAutomatedInboxConfig,
    assignments: ServerAutomatedInboxAssignment[],
    attempt: ReadAttempt,
  ): Promise<SegmentRead<string>> {
    const known = [...new Set(assignments.map(({ recordId }) => recordId))];
    const knownSet = new Set(known);
    const paddedPageReason = await this.paddedPageReason(logContext, config, known);

    if (!paddedPageReason) {
      Object.assign(attempt, {
        requestedPageSize: config.maxConcurrentRuns,
        notIn: known.length > 0,
      });

      try {
        const page = await this.config.segmentReaderPort.listRecordIds({
          ...AutomationPoller.segmentQuery(config),
          ...(known.length ? { excludedRecordIds: known } : {}),
          pageSize: config.maxConcurrentRuns,
        });

        // An agent that ignores an operator it does not know would hand known records back.
        return {
          items: page.filter(recordId => !knownSet.has(recordId)),
          requestedPageSize: config.maxConcurrentRuns,
        };
      } catch (error) {
        if (!known.length || !mayBeOperatorRefusal(error)) throw error;

        // Declared is not implemented: a datasource can list `not_in` and still refuse it.
        this.logger('Warn', 'The not_in candidate read failed, padding the page instead', {
          ...logContext,
          ...attempt,
          ...describeAgentFailure(error),
        });

        return this.readPaddedCandidates(
          logContext,
          config,
          assignments,
          knownSet,
          'not-in-refused',
          attempt,
        );
      }
    }

    return this.readPaddedCandidates(
      logContext,
      config,
      assignments,
      knownSet,
      paddedPageReason,
      attempt,
    );
  }

  // The padding is capped. It grows with the backlog, and the agent read it feeds is bounded by
  // the client's ten-second ceiling, so an uncapped page turns a large inbox into one that reads
  // nothing at all — worse than one that reads a partial page and finds fewer candidates.
  private async readPaddedCandidates(
    logContext: Record<string, unknown>,
    config: ServerAutomatedInboxConfig,
    assignments: ServerAutomatedInboxAssignment[],
    knownSet: ReadonlySet<string>,
    paddedPageReason: PaddedPageReason,
    attempt: ReadAttempt,
  ): Promise<SegmentRead<string>> {
    const requestedPageSize = Math.min(
      config.maxConcurrentRuns + assignments.length,
      MAX_CANDIDATE_PAGE_SIZE,
    );
    // agent-client sorts on one field: a composite key tied on its first column has no stable order
    // across offset pages, so it keeps the single unsorted page.
    const pageable = config.primaryKeys.length === 1;
    const maxPages = pageable ? MAX_PADDED_PAGES : 1;
    const candidates = new Set<string>();
    let pagesRead = 0;
    let reachedEnd = false;

    while (pagesRead < maxPages && candidates.size < config.maxConcurrentRuns && !reachedEnd) {
      pagesRead += 1;
      Object.assign(attempt, {
        requestedPageSize,
        pageNumber: pagesRead,
        paddedPageReason,
        notIn: false,
      });
      let page: string[];

      try {
        // eslint-disable-next-line no-await-in-loop
        page = await this.config.segmentReaderPort.listRecordIds({
          ...AutomationPoller.segmentQuery(config),
          pageSize: requestedPageSize,
          pageNumber: pagesRead,
          sortByPrimaryKey: pageable,
        });
      } catch (error) {
        if (candidates.size === 0) throw error;

        // The candidates the earlier pages found are still good: dropping them would send an empty
        // sync on every sweep of a slow agent.
        this.logger(
          'Warn',
          'A later padded candidate page failed, keeping what earlier pages found',
          {
            ...logContext,
            ...attempt,
            pagesRead,
            ...describeAgentFailure(error),
          },
        );
        break;
      }

      page
        .filter(recordId => !knownSet.has(recordId) && !candidates.has(recordId))
        .slice(0, config.maxConcurrentRuns - candidates.size)
        .forEach(id => candidates.add(id));
      reachedEnd = page.length < requestedPageSize;
    }

    if (candidates.size === 0 && !reachedEnd) {
      this.logger('Warn', 'The padded candidate read found no new record within its page cap', {
        ...logContext,
        known: knownSet.size,
        pagesRead,
        paddedPageReason,
      });
    }

    return {
      items: [...candidates],
      paddedPageReason,
      requestedPageSize,
      pagesRead,
    };
  }

  private async paddedPageReason(
    logContext: Record<string, unknown>,
    config: ServerAutomatedInboxConfig,
    known: string[],
  ): Promise<PaddedPageReason | undefined> {
    try {
      const { collectionName, primaryKeys, user, timezone } = AutomationPoller.segmentQuery(config);

      return await this.config.segmentReaderPort.exclusionUnavailableReason({
        collectionName,
        primaryKeys,
        user,
        timezone,
        liana: config.liana,
        knownRecordCount: known.length,
      });
    } catch (error) {
      this.logger('Warn', 'Could not read the agent capabilities, padding the page instead', {
        ...logContext,
        ...describeAgentFailure(error),
      });

      return 'capabilities-unreadable';
    }
  }

  private static segmentQuery(config: ServerAutomatedInboxConfig) {
    return {
      collectionName: config.collectionName,
      segment: config.segment,
      primaryKeys: config.primaryKeys,
      user: config.serviceAccountProfile,
      // Every executor instance must read a relative date the same way, so the machine's zone is
      // never the fallback. A zone the agent would reject is treated as an absent one: it answers
      // 400 on an unknown zone, which would fail every read of every sweep of that inbox.
      timezone: toProjectTimezone(config.timezone),
    };
  }
}
