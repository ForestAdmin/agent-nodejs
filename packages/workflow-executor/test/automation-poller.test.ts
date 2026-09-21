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

  describe('candidates', () => {
    it('should ask for a page holding the run cap plus every current assignment', async () => {
      const context = makeContext({
        assignments: [
          makeAssignment({ recordId: 'a', state: 'doing', runState: 'started' }),
          makeAssignment({ recordId: 'b', state: 'doing', runState: 'started' }),
        ],
      });

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: 'orders',
          primaryKeys: ['id'],
          segment: { kind: 'smart', name: 'to-review' },
          pageSize: 22,
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

    it('should reconcile a closed assignment that never had a run', async () => {
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

      // No run means nothing live to protect, so it is not the escalation case the gate exists for.
      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith(
        'inbox-1',
        expect.objectContaining({ closed: [{ recordId: 'never-ran', stillInSegment: false }] }),
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
        'Unknown workflow run state, leaving the record for a later poll',
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
      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-2', expect.anything());
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

      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-2', expect.anything());
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
      expect(context.automationPort.sync).toHaveBeenCalled();
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
