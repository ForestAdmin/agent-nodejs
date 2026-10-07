import type { AutomationPort } from '../ports/automation-port';
import type { Logger } from '../ports/logger-port';
import type { ExclusionUnavailableReason, SegmentReaderPort } from '../ports/segment-reader-port';
import type {
  AutomatedInbox,
  InboxAssignment,
  PlainSortClause,
  SegmentReadFailure,
} from '../types/automation';

import { mayBeOperatorRefusal, mayBeSortRefusal, toReadFailure } from './read-failure';
import {
  MAX_PADDED_PAGES,
  MEMBERSHIP_CHUNK_SIZE,
  chunk,
  isReadableRecordId,
  knownRecordIds,
  newCandidates,
  paddedPageSize,
  reconcilable,
  recordsToCheck,
  withUnexpectedRunState,
  withUnknownState,
} from './reconciliation';
import { AutomatedInboxGoneError, SegmentReadError, extractErrorMessage } from '../errors';

type PaddedPageReason =
  | ExclusionUnavailableReason
  | 'capabilities-unreadable'
  | 'not-in-refused'
  | 'not-in-ignored';

interface SegmentRead<T> {
  items: T[];
  paddedPageReason?: PaddedPageReason;
  requestedPageSize?: number;
  pagesRead?: number;
  failure?: SegmentReadFailure;
}

interface ReadAttempt {
  membershipChunk?: number;
  membershipChunks?: number;
  requestedPageSize?: number;
  pageNumber?: number;
  paddedPageReason?: PaddedPageReason;
  notIn?: boolean;
  inboxSortDropped?: boolean;
  sortedReadFailure?: { sort?: PlainSortClause[] } & ReturnType<typeof describeAgentFailure>;
}

function describeAgentFailure(error: unknown) {
  return {
    error: extractErrorMessage(error),
    httpStatus: error instanceof SegmentReadError ? error.httpStatus : undefined,
    agentError: error instanceof SegmentReadError ? error.agentDetail : undefined,
  };
}

interface PaddedOrder {
  sort?: PlainSortClause[];
  pageable: boolean;
}

function agentSort(
  inboxSort: PlainSortClause[] | undefined,
  sortsOnSeveralFields: boolean,
): PlainSortClause[] | undefined {
  return sortsOnSeveralFields ? inboxSort : inboxSort?.slice(0, 1);
}

// Offset pages only walk a total order, which only a single-column key can close as a tiebreak.
function paddedOrder(
  inbox: AutomatedInbox,
  wholeInboxSort: PlainSortClause[] | undefined,
  sortsOnSeveralFields: boolean,
): PaddedOrder {
  const [primaryKey] = inbox.primaryKeys;
  const byKey = { field: primaryKey, ascending: true };
  const inboxSort = agentSort(wholeInboxSort, sortsOnSeveralFields);

  if (inbox.primaryKeys.length !== 1) return { sort: inboxSort, pageable: false };
  if (!inboxSort) return { sort: [byKey], pageable: true };

  if (inboxSort.some(({ field }) => field === primaryKey)) {
    return { sort: inboxSort, pageable: true };
  }

  if (!sortsOnSeveralFields) return { sort: inboxSort, pageable: false };

  return { sort: [...inboxSort, byKey], pageable: true };
}

function activeInboxSort(inbox: AutomatedInbox, attempt: ReadAttempt) {
  return attempt.inboxSortDropped ? undefined : inbox.sort;
}

function segmentQuery(inbox: AutomatedInbox) {
  return {
    collectionName: inbox.collectionName,
    segment: inbox.segment,
    primaryKeys: inbox.primaryKeys,
    user: inbox.user,
    timezone: inbox.timezone,
  };
}

/**
 * One sweep of one automated inbox: reconciles the records whose run is over, reads new candidates,
 * and reports both to the orchestrator in a single sync.
 */
export default class InboxPoll {
  private readonly automationPort: AutomationPort;
  private readonly segmentReaderPort: SegmentReaderPort;
  private readonly logger: Logger;

  constructor(params: {
    automationPort: AutomationPort;
    segmentReaderPort: SegmentReaderPort;
    logger: Logger;
  }) {
    this.automationPort = params.automationPort;
    this.segmentReaderPort = params.segmentReaderPort;
    this.logger = params.logger;
  }

  async poll(inbox: AutomatedInbox): Promise<void> {
    const logContext = {
      inboxId: inbox.inboxId,
      renderingId: inbox.renderingId,
      workflowId: inbox.workflowId,
      collectionName: inbox.collectionName,
    };

    try {
      const assignments = await this.automationPort.listAssignments(inbox.inboxId);

      // Read independently, and neither is allowed to cost the other. Losing the reconciliation
      // because the candidate page timed out would leave those assignments open, which makes the
      // next page larger, which makes the next timeout likelier.
      const [closed, candidates] = await Promise.all([
        this.tryRead(logContext, 'closed records', attempt =>
          this.reconcileClosed(inbox, assignments, attempt),
        ),
        this.tryRead(logContext, 'new candidates', attempt =>
          this.readCandidates(logContext, inbox, assignments, attempt),
        ),
      ]);

      // The candidate read is the one that starts runs, so its failure is the one worth fixing.
      const readFailure = candidates.failure ?? closed.failure;

      // Sent even when both lists are empty or both reads failed: the orchestrator keeps the last
      // read failure until a sync comes without one, so a skipped sync would leave the settings
      // panel with a stale warning, or none at all.
      const results = await this.automationPort.sync(inbox.inboxId, {
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
    inbox: AutomatedInbox,
    assignments: InboxAssignment[],
    attempt: ReadAttempt,
  ): Promise<SegmentRead<{ recordId: string; stillInSegment: boolean }>> {
    const logContext = { inboxId: inbox.inboxId, renderingId: inbox.renderingId };

    for (const { state, recordId, workflowRunId } of withUnknownState(assignments)) {
      this.logger(
        'Warn',
        'Unknown assignment state, leaving the record out of every sweep until this executor knows it',
        { ...logContext, state, recordId, workflowRunId },
      );
    }

    const toReconcile = reconcilable(assignments);

    for (const { runState, recordId, workflowRunId } of withUnexpectedRunState(toReconcile)) {
      this.logger(
        'Warn',
        'Unexpected workflow run state, leaving the record out of every sweep until this executor knows it',
        { ...logContext, runState, recordId, workflowRunId },
      );
    }

    // An unreadable id is dropped one by one rather than failing the chunk, which would end
    // reconciliation for the whole inbox on every cycle, and left out of the report entirely:
    // telling the orchestrator it is not in the segment would retire its assignment and let the
    // record be launched again.
    const readable = recordsToCheck(assignments, toReconcile).filter(recordId => {
      if (isReadableRecordId(recordId, inbox.primaryKeys)) return true;

      this.logger('Warn', 'Unreadable record id, leaving the record out of the reconciliation', {
        ...logContext,
        recordId,
        primaryKeyCount: inbox.primaryKeys.length,
      });

      return false;
    });

    if (readable.length === 0) return { items: [] };

    const stillInSegment = new Set<string>();
    const batches = chunk(readable, MEMBERSHIP_CHUNK_SIZE);

    for (const [index, batch] of batches.entries()) {
      Object.assign(attempt, { membershipChunk: index + 1, membershipChunks: batches.length });
      // eslint-disable-next-line no-await-in-loop
      const found = await this.segmentReaderPort.listRecordIds({
        ...segmentQuery(inbox),
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

      return { items: [], failure: toReadFailure(error) };
    }
  }

  /**
   * Asks the agent for records the orchestrator has no assignment for. Excluding them in the query
   * is what keeps the page at the run cap: a record already treated but still in the segment stays
   * there for good, and left in the page it would take a slot on every poll from then on.
   */
  private async readCandidates(
    logContext: Record<string, unknown>,
    inbox: AutomatedInbox,
    assignments: InboxAssignment[],
    attempt: ReadAttempt,
  ): Promise<SegmentRead<string>> {
    const known = knownRecordIds(assignments);
    const knownSet = new Set(known);
    const paddedPageReason = await this.paddedPageReason(logContext, inbox, known);
    const sortsOnSeveralFields = this.segmentReaderPort.sortsOnSeveralFields(inbox.liana);

    if (!paddedPageReason) {
      Object.assign(attempt, {
        requestedPageSize: inbox.maxConcurrentRuns,
        notIn: known.length > 0,
      });

      let page: string[];

      try {
        page = await this.readWithInboxSort(
          logContext,
          inbox,
          attempt,
          inboxSort => agentSort(inboxSort, sortsOnSeveralFields),
          sort =>
            this.segmentReaderPort.listRecordIds({
              ...segmentQuery(inbox),
              ...(known.length ? { excludedRecordIds: known } : {}),
              pageSize: inbox.maxConcurrentRuns,
              sort,
            }),
        );
      } catch (error) {
        if (!known.length || !mayBeOperatorRefusal(error)) throw error;

        // Declared is not implemented: a datasource can list `not_in` and still refuse it.
        this.logger('Warn', 'The not_in candidate read failed, padding the page instead', {
          ...logContext,
          ...attempt,
          ...describeAgentFailure(error),
        });

        return this.readPaddedCandidates(logContext, inbox, knownSet, 'not-in-refused', attempt);
      }

      const fresh = page.filter(recordId => !knownSet.has(recordId));

      // An agent that ignores an operator it does not know hands known records back. A page of
      // nothing else would starve the inbox on every sweep, so it is padded like a refused read.
      if (page.length > 0 && fresh.length === 0) {
        this.logger(
          'Warn',
          'The not_in candidate read returned only known records, padding the page instead',
          {
            ...logContext,
            ...attempt,
          },
        );

        return this.readPaddedCandidates(logContext, inbox, knownSet, 'not-in-ignored', attempt);
      }

      return { items: fresh, requestedPageSize: inbox.maxConcurrentRuns };
    }

    return this.readPaddedCandidates(logContext, inbox, knownSet, paddedPageReason, attempt);
  }

  private async readPaddedCandidates(
    logContext: Record<string, unknown>,
    inbox: AutomatedInbox,
    knownSet: ReadonlySet<string>,
    paddedPageReason: PaddedPageReason,
    attempt: ReadAttempt,
  ): Promise<SegmentRead<string>> {
    const requestedPageSize = paddedPageSize(inbox.maxConcurrentRuns, knownSet.size);
    const sortsOnSeveralFields = this.segmentReaderPort.sortsOnSeveralFields(inbox.liana);
    const orderFor = (inboxSort: PlainSortClause[] | undefined) =>
      paddedOrder(inbox, inboxSort, sortsOnSeveralFields);
    const byKeyOrder = orderFor(undefined);
    let order = orderFor(activeInboxSort(inbox, attempt));
    let orderPagesRead = 0;
    const candidates = new Set<string>();
    let pagesRead = 0;
    let reachedEnd = false;

    while (
      pagesRead < MAX_PADDED_PAGES &&
      candidates.size < inbox.maxConcurrentRuns &&
      !reachedEnd
    ) {
      // A page in an order that cannot be paged may hold nothing but treated records: the key order
      // then walks past them, as it would without an inbox sort.
      if (orderPagesRead > 0 && !order.pageable) {
        if (!byKeyOrder.pageable) break;
        order = byKeyOrder;
        orderPagesRead = 0;
      }

      pagesRead += 1;
      orderPagesRead += 1;
      const pageNumber = orderPagesRead;
      const pageSort = order.sort;
      Object.assign(attempt, {
        requestedPageSize,
        pageNumber,
        paddedPageReason,
        notIn: false,
      });
      const readPage = (sort: PlainSortClause[] | undefined) =>
        this.segmentReaderPort.listRecordIds({
          ...segmentQuery(inbox),
          pageSize: requestedPageSize,
          pageNumber,
          sort,
        });
      let page: string[];

      try {
        // eslint-disable-next-line no-await-in-loop
        page = await (pagesRead === 1
          ? this.readWithInboxSort(
              logContext,
              inbox,
              attempt,
              inboxSort => orderFor(inboxSort).sort,
              readPage,
            )
          : readPage(pageSort));
        if (pagesRead === 1) order = orderFor(activeInboxSort(inbox, attempt));
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

      newCandidates(page, knownSet, candidates, inbox.maxConcurrentRuns - candidates.size).forEach(
        id => candidates.add(id),
      );
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

  /**
   * A sort field renamed or out of the service account's reach must not stop the inbox from
   * dispatching. Used on the not_in read and the first padded page only: a refused sort is refused
   * on the first page already. The order is dropped for the rest of the candidate read only once the
   * read without it succeeds, since a read failing both ways says nothing against the sort.
   */
  private async readWithInboxSort(
    logContext: Record<string, unknown>,
    inbox: AutomatedInbox,
    attempt: ReadAttempt,
    toSort: (inboxSort: PlainSortClause[] | undefined) => PlainSortClause[] | undefined,
    read: (sort: PlainSortClause[] | undefined) => Promise<string[]>,
  ): Promise<string[]> {
    const inboxSort = activeInboxSort(inbox, attempt);
    const sort = toSort(inboxSort);

    try {
      return await read(sort);
    } catch (error) {
      if (!inboxSort?.length || !mayBeSortRefusal(error)) throw error;

      let page: string[];

      try {
        page = await read(toSort(undefined));
      } catch (unsortedError) {
        Object.assign(attempt, { sortedReadFailure: { sort, ...describeAgentFailure(error) } });
        throw unsortedError;
      }

      this.logger('Warn', 'The agent rejected the inbox sort, reading candidates without it', {
        ...logContext,
        ...attempt,
        sort,
        ...describeAgentFailure(error),
      });
      Object.assign(attempt, { inboxSortDropped: true });

      return page;
    }
  }

  private async paddedPageReason(
    logContext: Record<string, unknown>,
    inbox: AutomatedInbox,
    known: string[],
  ): Promise<PaddedPageReason | undefined> {
    try {
      return await this.segmentReaderPort.exclusionUnavailableReason({
        collectionName: inbox.collectionName,
        primaryKeys: inbox.primaryKeys,
        user: inbox.user,
        timezone: inbox.timezone,
        liana: inbox.liana,
        knownRecordCount: known.length,
      });
    } catch (error) {
      if (!(error instanceof SegmentReadError)) throw error;

      this.logger('Warn', 'Could not read the agent capabilities, padding the page instead', {
        ...logContext,
        ...describeAgentFailure(error),
      });

      return 'capabilities-unreadable';
    }
  }
}
