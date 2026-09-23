import type {
  ServerAutomatedInboxAssignment,
  ServerAutomatedInboxConfig,
} from '../src/adapters/server-types';
import type { AutomationPort } from '../src/ports/automation-port';
import type {
  ListSegmentRecordIdsQuery,
  SegmentReaderPort,
} from '../src/ports/segment-reader-port';

import AutomationPoller from '../src/automation-poller';
import { AutomatedInboxGoneError } from '../src/errors';

const POLL_INTERVAL_S = 300;

function makeConfig(
  overrides: Partial<ServerAutomatedInboxConfig> = {},
): ServerAutomatedInboxConfig {
  return {
    inboxId: 'inbox-1',
    renderingId: 7,
    teamId: 3,
    workflowId: 'wf-1',
    collectionId: 'col-1',
    collectionName: 'orders',
    primaryKeys: ['id'],
    maxConcurrentRuns: 20,
    timezone: 'Europe/Paris',
    segment: { kind: 'smart', name: 'to-review' },
    serviceAccountProfile: {
      id: 99,
      email: 'bot@forestadmin.com',
      firstName: null,
      lastName: null,
      team: null,
      renderingId: 7,
      role: null,
      permissionLevel: null,
      tags: {},
    },
    ...overrides,
  };
}

function makeAssignment(
  overrides: Partial<ServerAutomatedInboxAssignment> = {},
): ServerAutomatedInboxAssignment {
  return {
    recordId: 'r1',
    state: 'done',
    workflowRunId: 1,
    runState: 'finished',
    ...overrides,
  };
}

function makeContext(options?: {
  inboxes?: ServerAutomatedInboxConfig[];
  assignments?: ServerAutomatedInboxAssignment[];
}) {
  const automationPort: jest.Mocked<AutomationPort> = {
    listAutomatedInboxes: jest.fn().mockResolvedValue(options?.inboxes ?? [makeConfig()]),
    listAssignments: jest.fn().mockResolvedValue(options?.assignments ?? []),
    sync: jest.fn().mockResolvedValue([]),
  };

  const segmentReaderPort: jest.Mocked<SegmentReaderPort> = {
    listRecordIds: jest.fn().mockResolvedValue([]),
    listFieldOperators: jest.fn().mockResolvedValue(['equal', 'in', 'not_in']),
  };

  const logger = jest.fn();

  return { automationPort, segmentReaderPort, logger };
}

function makePoller(context: ReturnType<typeof makeContext>, instanceId = 'host-1-abcd') {
  return new AutomationPoller({
    automationPort: context.automationPort,
    segmentReaderPort: context.segmentReaderPort,
    pollingIntervalS: POLL_INTERVAL_S,
    instanceId,
    logger: context.logger,
  });
}

/** Starts the poller, lets exactly one cycle fire, then stops it. */
async function runOneCycle(poller: AutomationPoller): Promise<void> {
  poller.start();
  await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 1000);
  await poller.stop();
}

describe('AutomationPoller', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('cycle scheduling', () => {
    it('should send its instance id so the orchestrator can elect a single poller', async () => {
      const context = makeContext();

      await runOneCycle(makePoller(context, 'worker-42'));

      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledWith('worker-42');
    });

    it('should not touch the agent when the orchestrator serves no inbox', async () => {
      const context = makeContext({ inboxes: [] });

      await runOneCycle(makePoller(context));

      expect(context.automationPort.listAssignments).not.toHaveBeenCalled();
      expect(context.segmentReaderPort.listRecordIds).not.toHaveBeenCalled();
      expect(context.automationPort.sync).not.toHaveBeenCalled();
    });

    it('should keep polling after a cycle that threw', async () => {
      const context = makeContext();
      context.automationPort.listAutomatedInboxes
        .mockRejectedValueOnce(new Error('orchestrator down'))
        .mockResolvedValue([makeConfig()]);

      const poller = makePoller(context);
      poller.start();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 1000);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 1000);
      await poller.stop();

      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledTimes(2);
      expect(context.logger).toHaveBeenCalledWith(
        'Error',
        'Automation poll cycle failed',
        expect.objectContaining({ error: expect.stringContaining('orchestrator down') }),
      );
    });

    it('should refuse to restart once stopped', async () => {
      const poller = makePoller(makeContext());
      poller.start();
      await poller.stop();

      expect(() => poller.start()).toThrow('cannot be restarted');
    });
  });

  describe('disabled', () => {
    it('should never reach the orchestrator when the interval says the sweep is off', async () => {
      const context = makeContext();
      const poller = new AutomationPoller({
        automationPort: context.automationPort,
        segmentReaderPort: context.segmentReaderPort,
        pollingIntervalS: 0,
        instanceId: 'host-1-abcd',
        logger: context.logger,
      });

      poller.start();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 10 * 1000);

      expect(context.automationPort.listAutomatedInboxes).not.toHaveBeenCalled();
      expect(context.logger).toHaveBeenCalledWith(
        'Info',
        'Automation poller disabled by configuration',
        expect.objectContaining({ instanceId: 'host-1-abcd' }),
      );

      // Still answers, so nothing downstream has to know an executor is running without a sweep.
      await expect(poller.stop()).resolves.toBeUndefined();
    });
  });

  describe('candidates', () => {
    const excluding = makeConfig({ liana: 'forest-nodejs-agent' });

    it('should ask the agent to leave out the records it already has an assignment for', async () => {
      const context = makeContext({
        inboxes: [excluding],
        assignments: [
          makeAssignment({ recordId: 'a', state: 'doing', runState: 'started' }),
          makeAssignment({ recordId: 'b' }),
        ],
      });

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: 'orders',
          primaryKeys: ['id'],
          segment: { kind: 'smart', name: 'to-review' },
          excludedRecordIds: ['a', 'b'],
          pageSize: 20,
        }),
      );
      expect(context.logger).toHaveBeenCalledWith(
        'Info',
        'Automated inbox polled',
        expect.objectContaining({ candidatePageSize: 20, paddedPageReason: undefined }),
      );
    });

    it('should drop a known record an agent hands back despite the exclusion', async () => {
      const context = makeContext({
        inboxes: [excluding],
        assignments: [makeAssignment({ recordId: 'known', state: 'doing', runState: 'started' })],
      });
      context.segmentReaderPort.listRecordIds.mockResolvedValue(['known', 'fresh-1']);

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [],
        candidates: ['fresh-1'],
      });
    });

    it('should ask the agent which operators the primary key declares', async () => {
      const context = makeContext({
        inboxes: [excluding],
        assignments: [makeAssignment({ recordId: 'a', state: 'doing', runState: 'started' })],
      });

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listFieldOperators).toHaveBeenCalledWith({
        collectionName: 'orders',
        field: 'id',
        user: excluding.serviceAccountProfile,
        timezone: 'Europe/Paris',
      });
    });

    it('should read the run cap without asking for capabilities when nothing is known yet', async () => {
      const context = makeContext({ inboxes: [excluding] });

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listFieldOperators).not.toHaveBeenCalled();
      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.not.objectContaining({ excludedRecordIds: expect.anything() }),
      );
      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 20 }),
      );
    });

    it('should pad the page instead when the primary key does not declare `not_in`', async () => {
      const context = makeContext({
        inboxes: [excluding],
        assignments: [makeAssignment({ recordId: 'a', state: 'doing', runState: 'started' })],
      });
      context.segmentReaderPort.listFieldOperators.mockResolvedValue(['equal', 'in']);

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.not.objectContaining({ excludedRecordIds: expect.anything() }),
      );
      expect(context.logger).toHaveBeenCalledWith(
        'Info',
        'Automated inbox polled',
        expect.objectContaining({
          candidatePageSize: 21,
          paddedPageReason: 'field-without-not-in',
        }),
      );
    });

    it('should pad the page and still sync when the capabilities cannot be read', async () => {
      const context = makeContext({
        inboxes: [excluding],
        assignments: [makeAssignment({ recordId: 'a', state: 'doing', runState: 'started' })],
      });
      context.segmentReaderPort.listFieldOperators.mockRejectedValue(new Error('HTTP 404'));
      context.segmentReaderPort.listRecordIds.mockResolvedValue(['a', 'fresh']);

      await runOneCycle(makePoller(context));

      expect(context.logger).toHaveBeenCalledWith(
        'Warn',
        'Could not read the agent capabilities, padding the page instead',
        expect.objectContaining({ inboxId: 'inbox-1', error: 'HTTP 404' }),
      );
      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [],
        candidates: ['fresh'],
      });
      expect(context.logger).toHaveBeenCalledWith(
        'Info',
        'Automated inbox polled',
        expect.objectContaining({
          candidatePageSize: 21,
          paddedPageReason: 'capabilities-unreadable',
        }),
      );
    });

    it('should fall back to a padded page in the same cycle when the agent refuses `not_in`', async () => {
      const context = makeContext({
        inboxes: [excluding],
        assignments: [makeAssignment({ recordId: 'a', state: 'doing', runState: 'started' })],
      });
      context.segmentReaderPort.listRecordIds
        .mockRejectedValueOnce(new Error('HTTP 500'))
        .mockResolvedValueOnce(['a', 'fresh']);

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ excludedRecordIds: ['a'], pageSize: 20 }),
      );
      expect(context.segmentReaderPort.listRecordIds).toHaveBeenNthCalledWith(
        2,
        expect.not.objectContaining({ excludedRecordIds: expect.anything() }),
      );
      expect(context.logger).toHaveBeenCalledWith(
        'Warn',
        'The not_in candidate read failed, padding the page instead',
        expect.objectContaining({ inboxId: 'inbox-1', error: 'HTTP 500' }),
      );
      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [],
        candidates: ['fresh'],
      });
      expect(context.logger).toHaveBeenCalledWith(
        'Info',
        'Automated inbox polled',
        expect.objectContaining({ candidatePageSize: 21, paddedPageReason: 'not-in-refused' }),
      );
    });

    it('should try `not_in` again on the next cycle after a refusal', async () => {
      const context = makeContext({
        inboxes: [excluding],
        assignments: [makeAssignment({ recordId: 'a', state: 'doing', runState: 'started' })],
      });
      context.segmentReaderPort.listRecordIds.mockRejectedValueOnce(new Error('HTTP 500'));
      const poller = makePoller(context);

      poller.start();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 1000);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 1000);
      await poller.stop();

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ excludedRecordIds: ['a'] }),
      );
    });

    it('should not fall back when a read with nothing to exclude fails', async () => {
      const context = makeContext({ inboxes: [excluding] });
      context.segmentReaderPort.listRecordIds.mockRejectedValue(new Error('HTTP 500'));

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledTimes(1);
      expect(context.logger).not.toHaveBeenCalledWith(
        'Warn',
        'The not_in candidate read failed, padding the page instead',
        expect.anything(),
      );
      expect(context.logger).toHaveBeenCalledWith(
        'Error',
        'Could not read new candidates of an automated inbox',
        expect.objectContaining({ inboxId: 'inbox-1', error: 'HTTP 500' }),
      );
    });

    it('should report the candidate read failed when the padded fallback fails too', async () => {
      const context = makeContext({
        inboxes: [excluding],
        assignments: [makeAssignment({ recordId: 'a', state: 'doing', runState: 'started' })],
      });
      context.segmentReaderPort.listRecordIds.mockRejectedValue(new Error('HTTP 500'));

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).not.toHaveBeenCalled();
      expect(context.logger).toHaveBeenCalledWith(
        'Error',
        'Could not read new candidates of an automated inbox',
        expect.objectContaining({ inboxId: 'inbox-1', error: 'HTTP 500' }),
      );
    });

    it('should name a record once even when it holds several assignments', async () => {
      const context = makeContext({
        inboxes: [excluding],
        assignments: [
          makeAssignment({ recordId: 'dup', state: 'doing', runState: 'started' }),
          makeAssignment({ recordId: 'dup' }),
        ],
      });

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.objectContaining({ excludedRecordIds: ['dup'], pageSize: 20 }),
      );
    });

    it.each(['forest-rails', 'forest-laravel', 'some-future-liana'])(
      'should pad the page without asking for capabilities on %s',
      async liana => {
        const context = makeContext({
          inboxes: [makeConfig({ liana })],
          assignments: [
            makeAssignment({ recordId: 'a', state: 'doing', runState: 'started' }),
            makeAssignment({ recordId: 'b', state: 'doing', runState: 'started' }),
          ],
        });

        await runOneCycle(makePoller(context));

        expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
          expect.objectContaining({ pageSize: 22 }),
        );
        expect(context.segmentReaderPort.listRecordIds).not.toHaveBeenCalledWith(
          expect.objectContaining({ excludedRecordIds: expect.anything() }),
        );
        expect(context.logger).toHaveBeenCalledWith(
          'Info',
          'Automated inbox polled',
          expect.objectContaining({
            candidatePageSize: 22,
            paddedPageReason: 'unknown-liana',
          }),
        );
        expect(context.segmentReaderPort.listFieldOperators).not.toHaveBeenCalled();
      },
    );

    it('should pad the page instead when the orchestrator names no agent', async () => {
      const context = makeContext({
        assignments: [makeAssignment({ recordId: 'a', state: 'doing', runState: 'started' })],
      });

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 21 }),
      );
      expect(context.logger).toHaveBeenCalledWith(
        'Info',
        'Automated inbox polled',
        expect.objectContaining({ candidatePageSize: 21, paddedPageReason: 'unknown-liana' }),
      );
    });

    it('should pad the page instead when the collection has a composite key', async () => {
      const context = makeContext({
        inboxes: [makeConfig({ liana: 'forest-nodejs-agent', primaryKeys: ['tenant', 'id'] })],
        assignments: [makeAssignment({ recordId: 't1|1', state: 'doing', runState: 'started' })],
      });

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 21 }),
      );
      expect(context.segmentReaderPort.listRecordIds).not.toHaveBeenCalledWith(
        expect.objectContaining({ excludedRecordIds: expect.anything() }),
      );
      expect(context.logger).toHaveBeenCalledWith(
        'Info',
        'Automated inbox polled',
        expect.objectContaining({ candidatePageSize: 21, paddedPageReason: 'composite-key' }),
      );
    });

    it('should still exclude when exactly the maximum number of records is known', async () => {
      const assignments = Array.from({ length: 150 }, (_unused, index) =>
        makeAssignment({ recordId: `r${index}`, state: 'doing', runState: 'started' }),
      );
      const context = makeContext({ inboxes: [excluding], assignments });

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.objectContaining({
          excludedRecordIds: expect.arrayContaining(['r0', 'r149']),
          pageSize: 20,
        }),
      );
      expect(context.logger).toHaveBeenCalledWith(
        'Info',
        'Automated inbox polled',
        expect.objectContaining({ candidatePageSize: 20, paddedPageReason: undefined }),
      );
    });

    it('should pad the page instead when too many records would travel in the query string', async () => {
      const assignments = Array.from({ length: 151 }, (_unused, index) =>
        makeAssignment({ recordId: `r${index}`, state: 'doing', runState: 'started' }),
      );
      const context = makeContext({ inboxes: [excluding], assignments });

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 171 }),
      );
      expect(context.logger).toHaveBeenCalledWith(
        'Info',
        'Automated inbox polled',
        expect.objectContaining({
          candidatePageSize: 171,
          paddedPageReason: 'too-many-known-records',
        }),
      );
    });

    it('should report only the segment records that have no assignment yet', async () => {
      const context = makeContext({
        assignments: [makeAssignment({ recordId: 'known', state: 'doing', runState: 'started' })],
      });
      context.segmentReaderPort.listRecordIds.mockResolvedValue(['known', 'fresh-1', 'fresh-2']);

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [],
        candidates: ['fresh-1', 'fresh-2'],
      });
    });

    it('should read relative dates in UTC when the project has no timezone', async () => {
      const context = makeContext({ inboxes: [makeConfig({ timezone: null })] });

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: 'UTC' }),
      );
    });
  });

  describe('guards on what the orchestrator sends', () => {
    it('should cap the padded page rather than ask for one the agent cannot serve', async () => {
      // The padding grows with the backlog while the agent read is bounded by the client's ten
      // second ceiling, so an uncapped page turns a large inbox into one that reads nothing at all.
      const context = makeContext({
        assignments: Array.from({ length: 900 }, (_, index) =>
          makeAssignment({ recordId: `r${index}`, state: 'doing', runState: 'started' }),
        ),
      });

      await runOneCycle(makePoller(context));

      const [query] = context.segmentReaderPort.listRecordIds.mock.calls.find(
        ([call]) => (call as ListSegmentRecordIdsQuery).recordIds === undefined,
      ) as [ListSegmentRecordIdsQuery];

      expect(query.pageSize).toBe(500);
    });

    it('should read a segment in UTC when the timezone is one the agent would refuse', async () => {
      // The agent answers 400 on an unknown zone, so passing it on would fail every read of every
      // sweep of that inbox with nothing saying why.
      const context = makeContext({ inboxes: [makeConfig({ timezone: 'Mars/Olympus' })] });

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: 'UTC' }),
      );
    });

    it('should leave a record whose packed id it cannot split out of the reconciliation', async () => {
      // Dropped one by one rather than failing the chunk, and never reported: telling the
      // orchestrator it left the segment would retire its assignment and let it be launched again.
      const context = makeContext({
        inboxes: [makeConfig({ primaryKeys: ['tenantId', 'id'] })],
        assignments: [makeAssignment({ recordId: 't1|a|5' }), makeAssignment({ recordId: 't2|9' })],
      });
      context.segmentReaderPort.listRecordIds.mockResolvedValue([]);

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [{ recordId: 't2|9', stillInSegment: false }],
        candidates: [],
      });
      expect(context.logger).toHaveBeenCalledWith(
        'Warn',
        'Unreadable record id, leaving the record out of the reconciliation',
        expect.objectContaining({ inboxId: 'inbox-1', recordId: 't1|a|5' }),
      );
    });
  });

  describe('reconciling closed assignments', () => {
    it('should ignore an assignment closed while its run is still going', async () => {
      // What an escalation leaves behind: the assignment is done, the run is not.
      const context = makeContext({
        assignments: [makeAssignment({ recordId: 'escalated', runState: 'started' })],
      });

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledTimes(1);
      expect(context.automationPort.sync).toHaveBeenCalledWith(
        'inbox-1',
        expect.objectContaining({ closed: [] }),
      );
    });

    it('should report a treated record as gone from the segment', async () => {
      const context = makeContext({
        assignments: [
          makeAssignment({ recordId: 'treated', runState: 'finished' }),
          makeAssignment({ recordId: 'stuck', runState: 'aborted', state: 'canceled' }),
        ],
      });
      context.segmentReaderPort.listRecordIds.mockImplementation(
        async ({ recordIds }: ListSegmentRecordIdsQuery) =>
          recordIds === undefined ? [] : recordIds.filter(id => id === 'stuck'),
      );

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith(
        'inbox-1',
        expect.objectContaining({
          closed: [
            { recordId: 'treated', stillInSegment: false },
            { recordId: 'stuck', stillInSegment: true },
          ],
        }),
      );
    });

    it('should say when an assignment state means nothing to it', async () => {
      const context = makeContext({
        assignments: [makeAssignment({ recordId: 'r1', state: 'a-state-from-the-future' })],
      });

      await runOneCycle(makePoller(context));

      // Held back like an unknown run state, and just as visibly — support has to be able to find
      // out why records stopped moving.
      expect(context.logger).toHaveBeenCalledWith(
        'Warn',
        'Unknown assignment state, leaving the record out of every sweep until this executor knows it',
        expect.objectContaining({ inboxId: 'inbox-1', state: 'a-state-from-the-future' }),
      );
    });

    it('should hold back a record whose other assignment still has a live run', async () => {
      const context = makeContext({
        assignments: [
          makeAssignment({
            recordId: 'x',
            workflowRunId: 1,
            state: 'canceled',
            runState: 'aborted',
          }),
          makeAssignment({ recordId: 'x', workflowRunId: 2, state: 'doing', runState: 'started' }),
        ],
      });

      await runOneCycle(makePoller(context));

      // One terminal assignment must not speak for a sibling whose workflow is still running: the
      // record would be reported as finished while a run is live on it.
      expect(context.automationPort.sync).toHaveBeenCalledWith(
        'inbox-1',
        expect.objectContaining({ closed: [] }),
      );
    });

    it('should ask for membership in chunks of fifty', async () => {
      const recordIds = Array.from({ length: 51 }, (_, index) => `r${index}`);
      const context = makeContext({
        assignments: recordIds.map(recordId => makeAssignment({ recordId })),
      });

      await runOneCycle(makePoller(context));

      const membershipCalls = context.segmentReaderPort.listRecordIds.mock.calls
        .map(([query]: [ListSegmentRecordIdsQuery]) => query)
        .filter(query => query.recordIds !== undefined);

      expect(membershipCalls).toHaveLength(2);
      expect(membershipCalls[0].recordIds).toHaveLength(50);
      expect(membershipCalls[1].recordIds).toEqual(['r50']);
      // A chunk cannot match more records than it asked about.
      expect(membershipCalls[1].pageSize).toBe(1);
    });

    it('should hold back a closed assignment that never had a run, and say so', async () => {
      const context = makeContext({
        assignments: [
          makeAssignment({
            recordId: 'never-ran',
            state: 'auto-canceled',
            workflowRunId: null,
            runState: null,
          }),
        ],
      });

      // The orchestrator binds the run before the assignment, so this shape should not exist. It is
      // surfaced rather than interpreted, either way.
      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith(
        'inbox-1',
        expect.objectContaining({ closed: [] }),
      );
      expect(context.logger).toHaveBeenCalledWith(
        'Warn',
        'Unexpected workflow run state, leaving the record out of every sweep until this executor knows it',
        expect.objectContaining({ inboxId: 'inbox-1', runState: null }),
      );
    });

    it('should hold back a run state it does not recognise, and say so', async () => {
      const context = makeContext({
        assignments: [makeAssignment({ recordId: 'r1', runState: 'a-state-from-the-future' })],
      });

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith(
        'inbox-1',
        expect.objectContaining({ closed: [] }),
      );
      expect(context.logger).toHaveBeenCalledWith(
        'Warn',
        'Unexpected workflow run state, leaving the record out of every sweep until this executor knows it',
        expect.objectContaining({ inboxId: 'inbox-1', runState: 'a-state-from-the-future' }),
      );
    });

    it('should report a record once even when it holds several closed assignments', async () => {
      const context = makeContext({
        assignments: [
          makeAssignment({ recordId: 'same', workflowRunId: 1 }),
          makeAssignment({
            recordId: 'same',
            workflowRunId: 2,
            state: 'canceled',
            runState: 'aborted',
          }),
        ],
      });

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith(
        'inbox-1',
        expect.objectContaining({ closed: [{ recordId: 'same', stillInSegment: false }] }),
      );
    });

    it('should not read the segment for membership when nothing is closed', async () => {
      const context = makeContext({
        assignments: [makeAssignment({ state: 'doing', runState: 'started' })],
      });

      await runOneCycle(makePoller(context));

      const membershipCalls = context.segmentReaderPort.listRecordIds.mock.calls.filter(
        ([query]: [ListSegmentRecordIdsQuery]) => query.recordIds !== undefined,
      );

      expect(membershipCalls).toHaveLength(0);
    });
  });

  describe('sync', () => {
    it('should sync an idle inbox so the orchestrator still hears from the poller', async () => {
      const context = makeContext();

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [],
        candidates: [],
      });
    });

    it('should still report the closed records when the candidate read fails', async () => {
      const context = makeContext({
        assignments: [makeAssignment({ recordId: 'treated' })],
      });
      context.segmentReaderPort.listRecordIds.mockImplementation(
        async ({ recordIds }: ListSegmentRecordIdsQuery) => {
          if (recordIds === undefined) throw new Error('segment page timed out');

          return [];
        },
      );

      await runOneCycle(makePoller(context));

      // Losing the reconciliation here would leave the assignment open, which makes the next page
      // bigger, which makes the next timeout likelier.
      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [{ recordId: 'treated', stillInSegment: false }],
        candidates: [],
      });
      expect(context.logger).toHaveBeenCalledWith(
        'Error',
        'Could not read new candidates of an automated inbox',
        expect.objectContaining({ inboxId: 'inbox-1' }),
      );
    });

    it('should still propose candidates when the membership read fails', async () => {
      const context = makeContext({
        assignments: [makeAssignment({ recordId: 'treated' })],
      });
      context.segmentReaderPort.listRecordIds.mockImplementation(
        async ({ recordIds }: ListSegmentRecordIdsQuery) => {
          if (recordIds !== undefined) throw new Error('membership read failed');

          return ['fresh'];
        },
      );

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [],
        candidates: ['fresh'],
      });
    });

    it('should report nothing when it could not reach the agent at all', async () => {
      const context = makeContext({ assignments: [makeAssignment({ recordId: 'treated' })] });
      context.segmentReaderPort.listRecordIds.mockRejectedValue(new Error('agent unreachable'));

      await runOneCycle(makePoller(context));

      // A sync here would tell the orchestrator this inbox is being swept while nothing is, which
      // is exactly what a "no sync received" alert must never be lied to about.
      expect(context.automationPort.sync).not.toHaveBeenCalled();
      expect(context.logger).toHaveBeenCalledWith(
        'Error',
        'Could not reach the agent, reporting nothing for this inbox',
        expect.objectContaining({ inboxId: 'inbox-1' }),
      );
    });

    it('should still report when only the read that had nothing to ask was skipped', async () => {
      // Nothing to reconcile, so that read never reaches the agent — but the candidate read did,
      // and a successful poll must not be mistaken for an unreachable agent.
      const context = makeContext();
      context.segmentReaderPort.listRecordIds.mockResolvedValue(['fresh']);

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [],
        candidates: ['fresh'],
      });
    });

    it('should log the outcomes the orchestrator decided', async () => {
      const context = makeContext();
      context.segmentReaderPort.listRecordIds.mockResolvedValue(['a', 'b', 'c']);
      context.automationPort.sync.mockResolvedValue([
        { recordId: 'a', outcome: 'started' },
        { recordId: 'b', outcome: 'started' },
        { recordId: 'c', outcome: 'skipped-cap' },
      ]);

      await runOneCycle(makePoller(context));

      expect(context.logger).toHaveBeenCalledWith(
        'Info',
        'Automated inbox polled',
        expect.objectContaining({
          inboxId: 'inbox-1',
          renderingId: 7,
          candidates: 3,
          outcomes: { started: 2, 'skipped-cap': 1 },
        }),
      );
    });
  });

  describe('failure isolation', () => {
    it('should drop an inbox the orchestrator stopped serving without failing the cycle', async () => {
      const context = makeContext({
        inboxes: [makeConfig(), makeConfig({ inboxId: 'inbox-2' })],
      });
      context.automationPort.listAssignments.mockImplementation(async (inboxId: string) => {
        if (inboxId === 'inbox-1') throw new AutomatedInboxGoneError(inboxId);

        return [];
      });

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledTimes(1);
      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-2', {
        closed: [],
        candidates: [],
      });
      expect(context.logger).toHaveBeenCalledWith(
        'Info',
        'Automated inbox no longer served, dropping it for this cycle',
        expect.objectContaining({ inboxId: 'inbox-1' }),
      );
    });

    it('should keep polling the other inboxes when one fails outright', async () => {
      const context = makeContext({
        inboxes: [makeConfig(), makeConfig({ inboxId: 'inbox-2' })],
      });
      context.automationPort.listAssignments.mockImplementation(async (inboxId: string) => {
        if (inboxId === 'inbox-1') throw new Error('agent unreachable');

        return [];
      });

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-2', {
        closed: [],
        candidates: [],
      });
      expect(context.logger).toHaveBeenCalledWith(
        'Error',
        'Automated inbox poll failed',
        expect.objectContaining({
          inboxId: 'inbox-1',
          error: expect.stringContaining('agent unreachable'),
        }),
      );
    });

    it('should delay the next sweep rather than stack one on a slow inbox', async () => {
      const context = makeContext();

      let release: () => void = () => {};

      context.automationPort.listAssignments.mockReturnValue(
        new Promise(resolve => {
          release = () => resolve([]);
        }),
      );

      const poller = makePoller(context);
      poller.start();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 3000);

      // Three intervals in, with the first cycle still reading: the next one is only scheduled once
      // this one is done, so a slow segment never stacks a second sweep on the customer's database.
      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledTimes(1);
      expect(context.automationPort.listAssignments).toHaveBeenCalledTimes(1);

      release();
      await poller.stop();
    });
  });

  describe('stop', () => {
    it('should wait for an in-flight inbox before reporting stopped', async () => {
      const context = makeContext();

      let release: () => void = () => {};

      context.automationPort.listAssignments.mockReturnValue(
        new Promise(resolve => {
          release = () => resolve([]);
        }),
      );

      const poller = makePoller(context);
      poller.start();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 1000);

      const stopped = poller.stop();

      expect(poller.state).toBe('draining');

      release();
      await stopped;

      expect(poller.state).toBe('stopped');
      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [],
        candidates: [],
      });
    });

    it('should wait for a cycle that has not reached an inbox yet', async () => {
      const context = makeContext();

      let release: () => void = () => {};

      context.automationPort.listAutomatedInboxes.mockReturnValue(
        new Promise(resolve => {
          release = () => resolve([makeConfig()]);
        }),
      );

      const poller = makePoller(context);
      poller.start();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 1000);

      // Nothing is registered yet: the cycle is still on the config route. Draining only the
      // per-inbox registry would let it read the agent after the host was told it had stopped.
      const stopped = poller.stop();
      let settled = false;
      void stopped.then(() => {
        settled = true;
      });
      await Promise.resolve();

      expect(settled).toBe(false);

      release();
      await stopped;

      expect(poller.state).toBe('stopped');
    });

    it('should not dispatch inboxes fetched while stop() was already running', async () => {
      const context = makeContext();

      let release: () => void = () => {};

      context.automationPort.listAutomatedInboxes.mockReturnValue(
        new Promise(resolve => {
          release = () => resolve([makeConfig()]);
        }),
      );

      const poller = makePoller(context);
      poller.start();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 1000);

      const stopped = poller.stop();
      release();
      await stopped;

      // Reading the customer's agent and starting runs during a shutdown that is only waiting on
      // this cycle would be work nobody asked for.
      expect(context.automationPort.listAssignments).not.toHaveBeenCalled();
      expect(context.automationPort.sync).not.toHaveBeenCalled();
    });

    it('should give up on a drain that outlives the stop timeout', async () => {
      const context = makeContext();
      context.automationPort.listAssignments.mockReturnValue(new Promise(() => {}));

      const poller = new AutomationPoller({
        automationPort: context.automationPort,
        segmentReaderPort: context.segmentReaderPort,
        pollingIntervalS: POLL_INTERVAL_S,
        instanceId: 'host-1',
        logger: context.logger,
        stopTimeoutS: 5,
      });

      poller.start();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 1000);

      const stopped = poller.stop();
      await jest.advanceTimersByTimeAsync(5_000);
      await stopped;

      expect(poller.state).toBe('stopped');
      expect(context.logger).toHaveBeenCalledWith(
        'Error',
        'Automation poller drain timeout',
        expect.objectContaining({ remainingInboxes: ['inbox-1'], timeoutS: 5 }),
      );
    });

    it('should stop scheduling new cycles', async () => {
      const context = makeContext();
      const poller = makePoller(context);

      poller.start();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 1000);
      await poller.stop();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 3000);

      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledTimes(1);
    });
  });
});
