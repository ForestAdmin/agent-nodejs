import type {
  ServerAutomatedInboxAssignment,
  ServerAutomatedInboxConfig,
} from '../src/adapters/server-types';
import type { AutomationPort } from '../src/ports/automation-port';
import type {
  ListSegmentRecordIdsQuery,
  SegmentReaderPort,
} from '../src/ports/segment-reader-port';

import { AgentHttpError } from '@forestadmin/agent-client';

import AutomationPoller from '../src/automation-poller';
import {
  AgentPortError,
  AutomatedInboxGoneError,
  CompositeRecordIdMismatchError,
  SegmentRecordIdMissingError,
} from '../src/errors';

const POLL_INTERVAL_S = 300;

function agentUnreachable(code: string): AgentPortError {
  return new AgentPortError(
    'listSegmentRecordIds',
    Object.assign(new Error(`agent unreachable: ${code}`), { code }),
  );
}

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
    holdLease: jest.fn().mockResolvedValue(true),
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
  await jest.advanceTimersByTimeAsync(0);
  await poller.stop();
}

function makeInboxes(count: number): ServerAutomatedInboxConfig[] {
  return Array.from({ length: count }, (_, index) => makeConfig({ inboxId: `inbox-${index + 1}` }));
}

const SLOW_INBOX_MS = 1000;

function makeInboxesSlow(context: ReturnType<typeof makeContext>): () => number {
  let open = 0;
  let maxOpen = 0;

  context.automationPort.listAssignments.mockImplementation(async () => {
    open += 1;
    maxOpen = Math.max(maxOpen, open);
    await new Promise(resolve => {
      setTimeout(resolve, SLOW_INBOX_MS);
    });
    open -= 1;

    return [];
  });

  return () => maxOpen;
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

      expect(context.automationPort.holdLease).toHaveBeenCalledWith('worker-42');
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
      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 1000 + 15_000);
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

      expect(context.automationPort.holdLease).not.toHaveBeenCalled();
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

  describe('lease heartbeat', () => {
    const LEASE_TTL_MS = 45_000;

    function makeSharedLease() {
      let holder: string | null = null;
      let expiresAt = 0;

      return async (instanceId: string): Promise<boolean> => {
        if (holder !== null && holder !== instanceId && Date.now() < expiresAt) return false;

        holder = instanceId;
        expiresAt = Date.now() + LEASE_TTL_MS;

        return true;
      };
    }

    const standingBy = (context: ReturnType<typeof makeContext>) =>
      context.logger.mock.calls.filter(
        ([level, message]) =>
          level === 'Info' &&
          message === 'Standing by, another instance sweeps the automated inboxes',
      );

    it('should replace a holder that stopped beating within a minute of its last renewal', async () => {
      const lease = makeSharedLease();
      const holder = makeContext();
      const standby = makeContext();
      let lastRenewalAt = 0;
      let dying = false;

      holder.automationPort.holdLease.mockImplementation(async instanceId => {
        if (dying && lastRenewalAt > 0) return new Promise<boolean>(() => {});

        const held = await lease(instanceId);
        if (dying) lastRenewalAt = Date.now();

        return held;
      });
      standby.automationPort.holdLease.mockImplementation(lease);

      const first = makePoller(holder, 'host-a');
      const second = makePoller(standby, 'host-b');
      first.start();
      await jest.advanceTimersByTimeAsync(1_000);
      second.start();
      await jest.advanceTimersByTimeAsync(100_000);

      expect(standby.automationPort.listAutomatedInboxes).not.toHaveBeenCalled();

      dying = true;
      await jest.advanceTimersByTimeAsync(15_000);

      expect(lastRenewalAt).toBeGreaterThan(0);

      let takeoverAt = 0;
      standby.automationPort.listAutomatedInboxes.mockImplementation(async () => {
        takeoverAt = Date.now();

        return [makeConfig()];
      });
      await jest.advanceTimersByTimeAsync(120_000);

      expect(takeoverAt).toBeGreaterThan(0);
      expect(takeoverAt - lastRenewalAt).toBeLessThanOrEqual(60_000);

      await second.stop();
    });

    it('should keep renewing the lease through a sweep that outlasts it', async () => {
      const lease = makeSharedLease();
      const holder = makeContext();
      const standby = makeContext();
      holder.automationPort.holdLease.mockImplementation(lease);
      standby.automationPort.holdLease.mockImplementation(lease);
      holder.automationPort.listAssignments.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve([]), 120_000);
          }),
      );

      const first = makePoller(holder, 'host-a');
      const second = makePoller(standby, 'host-b');
      first.start();
      await jest.advanceTimersByTimeAsync(0);
      second.start();
      await jest.advanceTimersByTimeAsync(120_000);

      expect(holder.automationPort.holdLease.mock.calls.length).toBeGreaterThanOrEqual(8);
      expect(standby.automationPort.listAutomatedInboxes).not.toHaveBeenCalled();

      await Promise.all([first.stop(), second.stop()]);
    });

    it('should stand by without ever asking for the inboxes while another instance holds the lease', async () => {
      const context = makeContext();
      context.automationPort.holdLease.mockResolvedValue(false);
      const poller = makePoller(context);

      poller.start();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 2 * 1000);
      await poller.stop();

      expect(context.automationPort.listAutomatedInboxes).not.toHaveBeenCalled();
      expect(standingBy(context)).toHaveLength(1);
    });

    it('should tell nothing configured apart from standing by', async () => {
      const context = makeContext({ inboxes: [] });

      await runOneCycle(makePoller(context));

      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledTimes(1);
      expect(context.logger).toHaveBeenCalledWith(
        'Debug',
        'No automated inbox to poll',
        expect.anything(),
      );
      expect(standingBy(context)).toHaveLength(0);
      expect(context.logger).toHaveBeenCalledWith(
        'Info',
        'Holding the automation poller lease, this instance sweeps the automated inboxes',
        expect.objectContaining({ instanceId: 'host-1-abcd' }),
      );
    });

    it('should sweep again only once the interval has passed since the previous sweep ended', async () => {
      const context = makeContext();
      context.automationPort.listAssignments.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve([]), 100_000);
          }),
      );
      const poller = makePoller(context);

      poller.start();
      await jest.advanceTimersByTimeAsync((100 + POLL_INTERVAL_S) * 1000 - 1);

      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(15_000);

      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(100_000);
      await poller.stop();
    });

    it('should drop back to standing by once the lease is refused', async () => {
      const context = makeContext();
      context.automationPort.holdLease.mockResolvedValueOnce(true).mockResolvedValue(false);
      const poller = makePoller(context);

      poller.start();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 3 * 1000);
      await poller.stop();

      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledTimes(1);
      expect(standingBy(context)).toHaveLength(1);
    });

    it('should stop dispatching the rest of a sweep once the lease is refused', async () => {
      const context = makeContext({ inboxes: makeInboxes(12) });
      context.automationPort.holdLease.mockResolvedValueOnce(true).mockResolvedValue(false);
      context.automationPort.listAssignments.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve([]), 20_000);
          }),
      );
      const poller = makePoller(context);

      poller.start();
      await jest.advanceTimersByTimeAsync(60_000);
      await poller.stop();

      expect(context.automationPort.listAssignments).toHaveBeenCalledTimes(5);
      expect(context.automationPort.sync).toHaveBeenCalledTimes(5);
    });

    it('should sweep right away when it wins the lease back', async () => {
      const context = makeContext();
      context.automationPort.holdLease
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      const poller = makePoller(context);

      poller.start();
      await jest.advanceTimersByTimeAsync(30_000);
      await poller.stop();

      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledTimes(2);
    });

    it('should finish a sweep through a heartbeat that fails', async () => {
      const context = makeContext({ inboxes: makeInboxes(12) });
      context.automationPort.holdLease
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('orchestrator unreachable'))
        .mockResolvedValue(true);
      context.automationPort.listAssignments.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve([]), 20_000);
          }),
      );
      const poller = makePoller(context);

      poller.start();
      await jest.advanceTimersByTimeAsync(60_000);
      await poller.stop();

      expect(context.automationPort.listAssignments).toHaveBeenCalledTimes(12);
    });

    it('should stop dispatching once its heartbeats have failed long enough for the lease to be gone', async () => {
      const context = makeContext({ inboxes: makeInboxes(12) });
      context.automationPort.holdLease
        .mockResolvedValueOnce(true)
        .mockRejectedValue(new Error('orchestrator unreachable'));
      context.automationPort.listAssignments.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve([]), 20_000);
          }),
      );
      const poller = makePoller(context);

      poller.start();
      await jest.advanceTimersByTimeAsync(80_000);
      await poller.stop();

      expect(context.automationPort.listAssignments).toHaveBeenCalledTimes(10);
      expect(context.logger).toHaveBeenCalledWith(
        'Warn',
        'No heartbeat landed for too long, standing by until one does',
        expect.objectContaining({ instanceId: 'host-1-abcd' }),
      );
    });

    it('should dispatch nothing 30 s after its last confirmed beat, even while slow beats are still failing', async () => {
      const context = makeContext({ inboxes: makeInboxes(12) });
      context.automationPort.holdLease.mockResolvedValueOnce(true).mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('timeout of 5000ms exceeded')), 5_000);
          }),
      );
      context.automationPort.listAssignments.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve([]), 17_000);
          }),
      );
      const poller = makePoller(context);

      poller.start();
      await jest.advanceTimersByTimeAsync(80_000);
      await poller.stop();

      expect(context.automationPort.listAssignments).toHaveBeenCalledTimes(10);
    });

    it('should sweep right away once it wins back a lease that cut its last sweep short', async () => {
      const context = makeContext({ inboxes: makeInboxes(12) });
      context.automationPort.holdLease
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      context.automationPort.listAssignments.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve([]), 40_000);
          }),
      );
      const poller = makePoller(context);

      poller.start();
      await jest.advanceTimersByTimeAsync(45_000);

      expect(context.automationPort.listAssignments).toHaveBeenCalledTimes(10);
      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledTimes(2);

      const stopped = poller.stop();
      await jest.advanceTimersByTimeAsync(40_000);
      await stopped;
    });

    it('should wait the full interval after a sweep the lease came back in time to finish', async () => {
      const context = makeContext({ inboxes: makeInboxes(12) });
      context.automationPort.holdLease
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      context.automationPort.listAssignments.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve([]), 40_000);
          }),
      );
      const poller = makePoller(context);

      poller.start();
      await jest.advanceTimersByTimeAsync(150_000);
      await poller.stop();

      expect(context.automationPort.listAssignments).toHaveBeenCalledTimes(12);
      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledTimes(1);
    });

    it('should keep its role and try again on the next beat when a heartbeat fails', async () => {
      const context = makeContext();
      context.automationPort.holdLease
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('orchestrator unreachable'))
        .mockResolvedValue(true);
      const poller = makePoller(context);

      poller.start();
      await jest.advanceTimersByTimeAsync(45_000);

      expect(context.automationPort.holdLease).toHaveBeenCalledTimes(4);
      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledTimes(1);
      expect(context.logger).toHaveBeenCalledWith(
        'Error',
        'Automation poller lease heartbeat failed',
        expect.objectContaining({ error: expect.stringContaining('orchestrator unreachable') }),
      );
      expect(standingBy(context)).toHaveLength(0);

      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 1000);
      await poller.stop();

      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledTimes(2);
    });

    it('should wait for a heartbeat in flight and start nothing from it once stopped', async () => {
      const context = makeContext();

      let answer: (held: boolean) => void = () => {};

      context.automationPort.holdLease.mockReturnValue(
        new Promise(resolve => {
          answer = resolve;
        }),
      );
      const poller = makePoller(context);

      poller.start();
      await jest.advanceTimersByTimeAsync(0);

      const stopped = poller.stop();
      let settled = false;
      void stopped.then(() => {
        settled = true;
      });
      await jest.advanceTimersByTimeAsync(1_000);

      expect(settled).toBe(false);

      answer(true);
      await stopped;
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 1000);

      expect(context.automationPort.listAutomatedInboxes).not.toHaveBeenCalled();
      expect(context.automationPort.holdLease).toHaveBeenCalledTimes(1);
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
      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 1000 + 15_000);
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

      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [],
        candidates: [],
        readFailure: { reason: 'segment-read-failed' },
      });
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

    describe('when one padded page holds nothing but known records', () => {
      const waitingOnAPerson = (count: number) =>
        Array.from({ length: count }, (_unused, index) =>
          makeAssignment({ recordId: `w${index}`, state: 'doing', runState: 'started' }),
        );
      const pageOf = (prefix: string, size = 500) =>
        Array.from({ length: size }, (_unused, index) => `${prefix}${index}`);

      it('should read the next pages, sorted by key, until it finds new records', async () => {
        const context = makeContext({ assignments: waitingOnAPerson(1000) });
        context.segmentReaderPort.listRecordIds
          .mockResolvedValueOnce(pageOf('w').slice(0, 500))
          .mockResolvedValueOnce(pageOf('w').map((_id, index) => `w${index + 500}`))
          .mockResolvedValueOnce(['fresh-1', 'fresh-2']);

        await runOneCycle(makePoller(context));

        expect(context.segmentReaderPort.listRecordIds.mock.calls.map(([query]) => query)).toEqual(
          [1, 2, 3].map(pageNumber =>
            expect.objectContaining({ pageSize: 500, pageNumber, sortByPrimaryKey: true }),
          ),
        );
        expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
          closed: [],
          candidates: ['fresh-1', 'fresh-2'],
        });
      });

      it('should stop reading as soon as a page yields enough candidates', async () => {
        const context = makeContext({ assignments: waitingOnAPerson(1000) });
        context.segmentReaderPort.listRecordIds.mockResolvedValue(pageOf('fresh-'));

        await runOneCycle(makePoller(context));

        expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledTimes(1);
      });

      it('should send no more candidates than the inbox can start runs for', async () => {
        const context = makeContext({ assignments: waitingOnAPerson(1000) });
        context.segmentReaderPort.listRecordIds.mockResolvedValue(pageOf('fresh-'));

        await runOneCycle(makePoller(context));

        expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
          closed: [],
          candidates: pageOf('fresh-', 20),
        });
      });

      it('should take from a later page only what the earlier pages left of the run budget', async () => {
        const context = makeContext({ assignments: waitingOnAPerson(1000) });
        context.segmentReaderPort.listRecordIds
          .mockResolvedValueOnce([...pageOf('w', 485), ...pageOf('fresh-', 15)])
          .mockResolvedValueOnce([
            ...Array.from({ length: 485 }, (_unused, index) => `w${index + 485}`),
            ...pageOf('late-', 15),
          ]);

        await runOneCycle(makePoller(context));

        expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledTimes(2);
        expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
          closed: [],
          candidates: [...pageOf('fresh-', 15), ...pageOf('late-', 5)],
        });
      });

      it('should not spend the run budget on a record an earlier page already brought', async () => {
        const context = makeContext({ assignments: waitingOnAPerson(1000) });
        context.segmentReaderPort.listRecordIds
          .mockResolvedValueOnce([...pageOf('w', 485), ...pageOf('fresh-', 15)])
          .mockResolvedValueOnce([
            'fresh-14',
            ...Array.from({ length: 484 }, (_unused, index) => `w${index + 485}`),
            ...pageOf('late-', 15),
          ]);

        await runOneCycle(makePoller(context));

        expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
          closed: [],
          candidates: [...pageOf('fresh-', 15), ...pageOf('late-', 5)],
        });
      });

      it('should page the same way when the fallback comes from a refused `not_in`', async () => {
        const context = makeContext({
          inboxes: [makeConfig({ liana: 'forest-nodejs-agent', maxConcurrentRuns: 480 })],
          assignments: waitingOnAPerson(30),
        });
        context.segmentReaderPort.listRecordIds
          .mockRejectedValueOnce(new Error('HTTP 500'))
          .mockResolvedValueOnce([...pageOf('w', 30), ...pageOf('fresh-', 470)])
          .mockResolvedValueOnce(pageOf('late-', 10));

        await runOneCycle(makePoller(context));

        expect(context.segmentReaderPort.listRecordIds).toHaveBeenNthCalledWith(
          3,
          expect.objectContaining({ pageSize: 500, pageNumber: 2, sortByPrimaryKey: true }),
        );
        expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
          closed: [],
          candidates: [...pageOf('fresh-', 470), ...pageOf('late-', 10)],
        });
        expect(context.logger).toHaveBeenCalledWith(
          'Info',
          'Automated inbox polled',
          expect.objectContaining({ paddedPageReason: 'not-in-refused', candidatePagesRead: 2 }),
        );
      });

      it('should stop at the end of the segment without warning', async () => {
        const context = makeContext({ assignments: waitingOnAPerson(1000) });
        context.segmentReaderPort.listRecordIds
          .mockResolvedValueOnce(pageOf('w'))
          .mockResolvedValueOnce(['w500']);

        await runOneCycle(makePoller(context));

        expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledTimes(2);
        expect(context.logger).not.toHaveBeenCalledWith(
          'Warn',
          expect.stringContaining('found no new record'),
          expect.anything(),
        );
      });

      it('should keep the candidates of earlier pages when a later page fails', async () => {
        const context = makeContext({ assignments: waitingOnAPerson(1000) });
        context.segmentReaderPort.listRecordIds
          .mockResolvedValueOnce([...pageOf('w').slice(0, 493), ...pageOf('fresh-', 7)])
          .mockRejectedValueOnce(new Error('timeout of 10000ms exceeded'));

        await runOneCycle(makePoller(context));

        expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
          closed: [],
          candidates: pageOf('fresh-', 7),
        });
      });

      it('should report the candidate read failed when the first page fails', async () => {
        const context = makeContext({ assignments: waitingOnAPerson(1000) });
        context.segmentReaderPort.listRecordIds.mockRejectedValue(new Error('agent down'));

        await runOneCycle(makePoller(context));

        expect(context.logger).toHaveBeenCalledWith(
          'Error',
          'Could not read new candidates of an automated inbox',
          expect.objectContaining({ error: 'agent down' }),
        );
        expect(context.automationPort.sync).toHaveBeenCalledWith(
          'inbox-1',
          expect.objectContaining({ readFailure: { reason: 'segment-read-failed' } }),
        );
      });

      it('should report the candidate read failed when a later page fails before any candidate', async () => {
        const context = makeContext({ assignments: waitingOnAPerson(1000) });
        context.segmentReaderPort.listRecordIds
          .mockResolvedValueOnce(pageOf('w'))
          .mockRejectedValueOnce(new Error('timeout of 10000ms exceeded'));

        await runOneCycle(makePoller(context));

        expect(context.logger).toHaveBeenCalledWith(
          'Error',
          'Could not read new candidates of an automated inbox',
          expect.objectContaining({ error: 'timeout of 10000ms exceeded' }),
        );
        expect(context.logger).not.toHaveBeenCalledWith(
          'Warn',
          'The padded candidate read found no new record within its page cap',
          expect.anything(),
        );
      });

      it('should read a composite key in one unsorted page, which offset paging cannot walk', async () => {
        const context = makeContext({
          inboxes: [makeConfig({ primaryKeys: ['tenantId', 'id'] })],
          assignments: waitingOnAPerson(1000).map(assignment => ({
            ...assignment,
            recordId: `t|${assignment.recordId}`,
          })),
        });
        context.segmentReaderPort.listRecordIds.mockResolvedValue(pageOf('w').map(id => `t|${id}`));

        await runOneCycle(makePoller(context));

        expect(context.segmentReaderPort.listRecordIds.mock.calls.map(([query]) => query)).toEqual([
          expect.objectContaining({ pageNumber: 1, sortByPrimaryKey: false }),
        ]);
      });

      it('should read at most five pages, then warn with what it knows', async () => {
        const context = makeContext({ assignments: waitingOnAPerson(3000) });
        context.segmentReaderPort.listRecordIds.mockImplementation(async ({ pageNumber }) =>
          pageOf('w').map((_id, index) => `w${((pageNumber ?? 1) - 1) * 500 + index}`),
        );

        await runOneCycle(makePoller(context));

        expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledTimes(5);
        expect(context.logger).toHaveBeenCalledWith(
          'Warn',
          'The padded candidate read found no new record within its page cap',
          expect.objectContaining({
            known: 3000,
            pagesRead: 5,
            paddedPageReason: 'too-many-known-records',
          }),
        );
        expect(context.logger).toHaveBeenCalledWith(
          'Info',
          'Automated inbox polled',
          expect.objectContaining({ candidatePagesRead: 5 }),
        );
      });
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
      // Still in the segment now proves nothing: the run has not yet had its chance to take it out.
      const context = makeContext({
        assignments: [makeAssignment({ recordId: 'run-going', runState: 'started' })],
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

    it('should report a doing record whose run finished as gone from the segment', async () => {
      const context = makeContext({
        assignments: [makeAssignment({ recordId: 'left', state: 'doing', runState: 'finished' })],
      });

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.objectContaining({ recordIds: ['left'] }),
      );
      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [{ recordId: 'left', stillInSegment: false }],
        candidates: [],
      });
    });

    it('should report a doing record whose run finished as still in the segment', async () => {
      const context = makeContext({
        assignments: [makeAssignment({ recordId: 'stays', state: 'doing', runState: 'finished' })],
      });
      context.segmentReaderPort.listRecordIds.mockImplementation(
        async ({ recordIds }: ListSegmentRecordIdsQuery) => recordIds ?? [],
      );

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [{ recordId: 'stays', stillInSegment: true }],
        candidates: [],
      });
    });

    it('should report a doing record whose run was aborted like one whose run finished', async () => {
      const context = makeContext({
        assignments: [
          makeAssignment({ recordId: 'finished-doing', state: 'doing', runState: 'finished' }),
          makeAssignment({ recordId: 'aborted-doing', state: 'doing', runState: 'aborted' }),
        ],
      });
      context.segmentReaderPort.listRecordIds.mockImplementation(
        async ({ recordIds }: ListSegmentRecordIdsQuery) => recordIds ?? [],
      );

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.objectContaining({ recordIds: ['finished-doing', 'aborted-doing'] }),
      );
      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [
          { recordId: 'finished-doing', stillInSegment: true },
          { recordId: 'aborted-doing', stillInSegment: true },
        ],
        candidates: [],
      });
    });

    it('should not read the membership of a doing record whose run is still going', async () => {
      const context = makeContext({
        assignments: [makeAssignment({ recordId: 'running', state: 'doing', runState: 'started' })],
      });

      await runOneCycle(makePoller(context));

      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledTimes(1);
      expect(context.segmentReaderPort.listRecordIds).toHaveBeenCalledWith(
        expect.not.objectContaining({ recordIds: expect.anything() }),
      );
      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [],
        candidates: [],
      });
    });

    it('should leave a doing assignment with no run out of the reconciliation without a warning', async () => {
      const context = makeContext({
        assignments: [
          makeAssignment({
            recordId: 'human',
            state: 'doing',
            workflowRunId: null,
            runState: null,
          }),
        ],
      });

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith(
        'inbox-1',
        expect.objectContaining({ closed: [] }),
      );
      expect(context.logger).not.toHaveBeenCalledWith(
        'Warn',
        'Unexpected workflow run state, leaving the record out of every sweep until this executor knows it',
        expect.anything(),
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

    it('should leave a closed assignment that never had a run to the human, without a warning', async () => {
      const context = makeContext({
        assignments: [
          makeAssignment({
            recordId: 'human-closed',
            state: 'auto-canceled',
            workflowRunId: null,
            runState: null,
          }),
        ],
      });
      // Still in the segment: the executor must leave it to the human, not turn it into a candidate.
      context.segmentReaderPort.listRecordIds.mockResolvedValue(['human-closed']);

      // A person, not the orchestrator, made this assignment: the orchestrator binds the run first,
      // so a runless one is the human's. There is nothing to reconcile, and the old warning promised
      // "until this executor knows it" while no run would ever appear — repeating on every sweep
      // forever is the noise this fixes.
      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [],
        candidates: [],
      });
      expect(context.logger).not.toHaveBeenCalledWith(
        'Warn',
        'Unexpected workflow run state, leaving the record out of every sweep until this executor knows it',
        expect.anything(),
      );
    });

    it('should warn when a bound run reports no state, a contract break', async () => {
      const context = makeContext({
        assignments: [
          makeAssignment({
            recordId: 'automated',
            state: 'done',
            workflowRunId: 7,
            runState: null,
          }),
        ],
      });

      await runOneCycle(makePoller(context));

      // A workflowRunId means the orchestrator bound a run, whose state is NOT NULL server-side: a
      // null state here is a contract break, not a human assignment, so it stays held and visible
      // under the warning rather than being dropped.
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
          if (recordIds === undefined) throw agentUnreachable('ECONNABORTED');

          return [];
        },
      );

      await runOneCycle(makePoller(context));

      // Losing the reconciliation here would leave the assignment open, which makes the next page
      // bigger, which makes the next timeout likelier.
      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [{ recordId: 'treated', stillInSegment: false }],
        candidates: [],
        readFailure: { reason: 'agent-unreachable' },
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
        readFailure: { reason: 'segment-read-failed' },
      });
    });

    it('should still sync, with the failure, when it could not reach the agent at all', async () => {
      const context = makeContext({ assignments: [makeAssignment({ recordId: 'treated' })] });
      context.segmentReaderPort.listRecordIds.mockRejectedValue(agentUnreachable('ECONNREFUSED'));

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [],
        candidates: [],
        readFailure: { reason: 'agent-unreachable' },
      });
    });

    it('should send no read failure when every read succeeded', async () => {
      const context = makeContext({ assignments: [makeAssignment({ recordId: 'treated' })] });
      context.segmentReaderPort.listRecordIds.mockResolvedValue([]);

      await runOneCycle(makePoller(context));

      expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
        closed: [{ recordId: 'treated', stillInSegment: false }],
        candidates: [],
      });
    });

    describe('read failure reported with the sync', () => {
      const agentAnswered = (status: number) =>
        new AgentPortError('listSegmentRecordIds', new AgentHttpError(status, {}, ''));

      it.each([
        ['a 401', agentAnswered(401), { reason: 'agent-forbidden', httpStatus: 401 }],
        ['a 403', agentAnswered(403), { reason: 'agent-forbidden', httpStatus: 403 }],
        ['a 502', agentAnswered(502), { reason: 'agent-unreachable', httpStatus: 502 }],
        ['a 503', agentAnswered(503), { reason: 'agent-unreachable', httpStatus: 503 }],
        ['a 504', agentAnswered(504), { reason: 'agent-unreachable', httpStatus: 504 }],
        ['a 500', agentAnswered(500), { reason: 'segment-read-failed', httpStatus: 500 }],
        ['a 400', agentAnswered(400), { reason: 'segment-read-failed', httpStatus: 400 }],
        ['a timeout', agentUnreachable('ECONNABORTED'), { reason: 'agent-unreachable' }],
        ['a refused connection', agentUnreachable('ECONNREFUSED'), { reason: 'agent-unreachable' }],
        ['an unknown host', agentUnreachable('ENOTFOUND'), { reason: 'agent-unreachable' }],
        ['a reset connection', agentUnreachable('ECONNRESET'), { reason: 'agent-unreachable' }],
        ['a temporary DNS failure', agentUnreachable('EAI_AGAIN'), { reason: 'agent-unreachable' }],
        ['an unreachable host', agentUnreachable('EHOSTUNREACH'), { reason: 'agent-unreachable' }],
        [
          'an unreachable network',
          agentUnreachable('ENETUNREACH'),
          { reason: 'agent-unreachable' },
        ],
        ['a broken pipe', agentUnreachable('EPIPE'), { reason: 'agent-unreachable' }],
        ['a socket timeout', agentUnreachable('ETIMEDOUT'), { reason: 'agent-unreachable' }],
        ['a response without a status', agentAnswered(0), { reason: 'agent-unreachable' }],
        [
          'an error of its own before any answer',
          new AgentPortError(
            'listSegmentRecordIds',
            new Error('secretOrPrivateKey must have a value'),
          ),
          { reason: 'segment-read-failed' },
        ],
        [
          'a record without an id',
          new SegmentRecordIdMissingError('orders'),
          { reason: 'segment-read-failed' },
        ],
        [
          'a record id it cannot split',
          new CompositeRecordIdMismatchError('1', 2),
          { reason: 'segment-read-failed' },
        ],
      ])('should name the failure of a candidate read that got %s', async (_, error, expected) => {
        const context = makeContext();
        context.segmentReaderPort.listRecordIds.mockRejectedValue(error);

        await runOneCycle(makePoller(context));

        expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
          closed: [],
          candidates: [],
          readFailure: expected,
        });
      });

      it('should report the candidate read failure over the membership one', async () => {
        const context = makeContext({ assignments: [makeAssignment({ recordId: 'treated' })] });
        context.segmentReaderPort.listRecordIds.mockImplementation(
          async ({ recordIds }: ListSegmentRecordIdsQuery) => {
            throw agentAnswered(recordIds === undefined ? 500 : 403);
          },
        );

        await runOneCycle(makePoller(context));

        expect(context.automationPort.sync).toHaveBeenCalledWith(
          'inbox-1',
          expect.objectContaining({
            readFailure: { reason: 'segment-read-failed', httpStatus: 500 },
          }),
        );
      });

      it('should report a membership read failure when the candidate read worked', async () => {
        const context = makeContext({ assignments: [makeAssignment({ recordId: 'treated' })] });
        context.segmentReaderPort.listRecordIds.mockImplementation(
          async ({ recordIds }: ListSegmentRecordIdsQuery) => {
            if (recordIds !== undefined) throw agentAnswered(403);

            return [];
          },
        );

        await runOneCycle(makePoller(context));

        expect(context.automationPort.sync).toHaveBeenCalledWith(
          'inbox-1',
          expect.objectContaining({
            readFailure: { reason: 'agent-forbidden', httpStatus: 403 },
          }),
        );
      });

      it('should fail the whole membership read when a later chunk fails', async () => {
        const recordIds = Array.from({ length: 51 }, (_, index) => `r${index}`);
        const context = makeContext({
          assignments: recordIds.map(recordId => makeAssignment({ recordId })),
        });
        context.segmentReaderPort.listRecordIds.mockImplementation(
          async ({ recordIds: batch }: ListSegmentRecordIdsQuery) => {
            if (batch === undefined) return [];
            if (batch.includes('r50')) throw agentAnswered(503);

            return [];
          },
        );

        await runOneCycle(makePoller(context));

        // All-or-nothing: the first chunk's results are dropped, and the read reports the failure.
        expect(context.automationPort.sync).toHaveBeenCalledWith('inbox-1', {
          closed: [],
          candidates: [],
          readFailure: { reason: 'agent-unreachable', httpStatus: 503 },
        });
      });

      it('should name the failure in the poll log line', async () => {
        const context = makeContext();
        context.segmentReaderPort.listRecordIds.mockRejectedValue(agentAnswered(403));

        await runOneCycle(makePoller(context));

        expect(context.logger).toHaveBeenCalledWith(
          'Info',
          'Automated inbox polled',
          expect.objectContaining({ inboxId: 'inbox-1', readFailure: 'agent-forbidden' }),
        );
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

  describe('bounded sweep', () => {
    it('should read at most five inboxes at once and still sweep them all in the cycle', async () => {
      const context = makeContext({ inboxes: makeInboxes(12) });
      const maxOpen = makeInboxesSlow(context);

      const poller = makePoller(context);
      poller.start();
      await jest.advanceTimersByTimeAsync(3 * SLOW_INBOX_MS);
      await poller.stop();

      expect(maxOpen()).toBe(5);
      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledTimes(1);
      expect(context.automationPort.sync).toHaveBeenCalledTimes(12);
    });

    it('should hand the slot of a failed inbox to the next one right away', async () => {
      const context = makeContext({ inboxes: makeInboxes(6) });
      makeInboxesSlow(context);
      context.automationPort.listAssignments.mockRejectedValueOnce(new Error('agent unreachable'));

      const poller = makePoller(context);
      poller.start();
      await jest.advanceTimersByTimeAsync(0);

      expect(context.automationPort.listAssignments).toHaveBeenCalledWith('inbox-6');

      await jest.advanceTimersByTimeAsync(SLOW_INBOX_MS);
      await poller.stop();

      expect(context.automationPort.sync).toHaveBeenCalledTimes(5);
      expect(context.automationPort.sync).not.toHaveBeenCalledWith('inbox-1', expect.anything());
    });
  });

  describe('stop', () => {
    it('should finish the inboxes in flight but not start the queued ones', async () => {
      const context = makeContext({ inboxes: makeInboxes(12) });
      makeInboxesSlow(context);

      const poller = makePoller(context);
      poller.start();
      await jest.advanceTimersByTimeAsync(0);

      const stopped = poller.stop();
      await jest.advanceTimersByTimeAsync(3 * SLOW_INBOX_MS);
      await stopped;

      const inFlight = ['inbox-1', 'inbox-2', 'inbox-3', 'inbox-4', 'inbox-5'];

      expect(context.automationPort.listAssignments.mock.calls.map(([inboxId]) => inboxId)).toEqual(
        inFlight,
      );
      expect(context.automationPort.sync.mock.calls.map(([inboxId]) => inboxId)).toEqual(inFlight);
    });

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
      await jest.advanceTimersByTimeAsync(0);

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
      await jest.advanceTimersByTimeAsync(0);

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
      await jest.advanceTimersByTimeAsync(0);

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
      await jest.advanceTimersByTimeAsync(0);

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
      await jest.advanceTimersByTimeAsync(0);
      await poller.stop();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_S * 3000);

      expect(context.automationPort.listAutomatedInboxes).toHaveBeenCalledTimes(1);
    });
  });
});
