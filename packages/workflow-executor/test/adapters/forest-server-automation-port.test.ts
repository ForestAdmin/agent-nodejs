import type { ServerAutomatedInboxConfig } from '../../src/adapters/server-types';

import { ServerUtils } from '@forestadmin/forestadmin-client';

import ForestServerAutomationPort from '../../src/adapters/forest-server-automation-port';
import { AutomatedInboxGoneError, WorkflowPortError } from '../../src/errors';

jest.mock('@forestadmin/forestadmin-client', () => ({
  ServerUtils: { query: jest.fn() },
}));

const mockQuery = ServerUtils.query as jest.Mock;

const options = { envSecret: 'env-secret-123', forestServerUrl: 'https://api.forestadmin.com' };

function httpError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

function makeConfig(overrides: Partial<ServerAutomatedInboxConfig> = {}) {
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

describe('ForestServerAutomationPort', () => {
  let logger: jest.Mock;
  let port: ForestServerAutomationPort;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = jest.fn();
    port = new ForestServerAutomationPort({ ...options, logger });
  });

  describe('listAutomatedInboxes', () => {
    it('should carry the instance id on the config route', async () => {
      mockQuery.mockResolvedValue({ inboxes: [] });

      await port.listAutomatedInboxes('worker 42');

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/api/workflow-orchestrator/automated-inboxes?instanceId=worker%2042',
      );
    });

    it('should return the configs the orchestrator serves', async () => {
      mockQuery.mockResolvedValue({ inboxes: [makeConfig()] });

      await expect(port.listAutomatedInboxes('w1')).resolves.toEqual([
        expect.objectContaining({ inboxId: 'inbox-1', maxConcurrentRuns: 20 }),
      ]);
    });

    it.each([
      ['smart', { kind: 'smart', name: 'to-review' }],
      ['sql', { kind: 'sql', query: 'SELECT id FROM orders', connectionName: null }],
      [
        'filter',
        { kind: 'filter', conditionTree: { field: 'status', operator: 'equal', value: 'new' } },
      ],
    ])('should accept a %s segment descriptor', async (_kind, segment) => {
      mockQuery.mockResolvedValue({ inboxes: [makeConfig({ segment: segment as never })] });

      const [config] = await port.listAutomatedInboxes('w1');

      expect(config.segment).toEqual(segment);
    });

    it('should keep an inbox missing a field the poller never reads', async () => {
      const { teamId, collectionId, workflowId, ...rest } = makeConfig();

      mockQuery.mockResolvedValue({ inboxes: [rest] });

      // Dropping it would stop the automation over a field that changes nothing about the sweep.
      await expect(port.listAutomatedInboxes('w1')).resolves.toHaveLength(1);
    });

    it('should skip one unreadable config and keep the rest', async () => {
      mockQuery.mockResolvedValue({
        inboxes: [
          makeConfig({ inboxId: 'good' }),
          { inboxId: 'bad', segment: { kind: 'unknown-to-this-executor' } },
        ],
      });

      const configs = await port.listAutomatedInboxes('w1');

      expect(configs.map(({ inboxId }) => inboxId)).toEqual(['good']);
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'Skipping an automated inbox config the executor cannot read',
        expect.objectContaining({ inboxId: 'bad', index: 1 }),
      );
    });

    it('should read a 404 as an orchestrator that has no such route', async () => {
      mockQuery.mockRejectedValue(httpError(404));

      await expect(port.listAutomatedInboxes('w1')).resolves.toEqual([]);
    });

    it('should say the route is missing once at Warn, then stay quiet', async () => {
      mockQuery.mockRejectedValue(httpError(404));

      await port.listAutomatedInboxes('w1');
      await port.listAutomatedInboxes('w1');
      await port.listAutomatedInboxes('w1');

      // A wrong forestServerUrl looks identical and never resolves itself, so it has to be visible
      // — but not as a line every cycle for the release window this is expected in.
      const levels = logger.mock.calls
        .filter(([, message]) => String(message).includes('does not serve automated inboxes'))
        .map(([level]) => level);

      expect(levels).toEqual(['Warn', 'Debug', 'Debug']);
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        expect.stringContaining('check forestServerUrl if it persists'),
        expect.objectContaining({ forestServerUrl: options.forestServerUrl }),
      );
    });

    it('should surface a server failure rather than reporting an empty environment', async () => {
      mockQuery.mockRejectedValue(httpError(500));

      await expect(port.listAutomatedInboxes('w1')).rejects.toThrow(WorkflowPortError);
    });
  });

  describe('listAssignments', () => {
    it('should return the assignments with their bound run state', async () => {
      mockQuery.mockResolvedValue({
        assignments: [
          { recordId: 'r1', state: 'doing', workflowRunId: 12, runState: 'started' },
          { recordId: 'r2', state: 'done', workflowRunId: 13, runState: 'finished' },
        ],
      });

      await expect(port.listAssignments('inbox-1')).resolves.toEqual([
        { recordId: 'r1', state: 'doing', workflowRunId: 12, runState: 'started' },
        { recordId: 'r2', state: 'done', workflowRunId: 13, runState: 'finished' },
      ]);
      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/api/workflow-orchestrator/automated-inboxes/inbox-1/assignments',
      );
    });

    it('should report an inbox the orchestrator no longer serves', async () => {
      mockQuery.mockRejectedValue(httpError(404));

      await expect(port.listAssignments('inbox-1')).rejects.toThrow(AutomatedInboxGoneError);
    });

    it('should keep a run state the executor does not know rather than blank it', async () => {
      mockQuery.mockResolvedValue({
        assignments: [
          {
            recordId: 'r1',
            state: 'doing',
            workflowRunId: 12,
            runState: 'a-state-from-the-future',
          },
        ],
      });

      // Blanking it would read as "still running" and strand the record silently.
      await expect(port.listAssignments('inbox-1')).resolves.toEqual([
        { recordId: 'r1', state: 'doing', workflowRunId: 12, runState: 'a-state-from-the-future' },
      ]);
    });

    it('should not lose a whole inbox to one assignment in an unknown state', async () => {
      mockQuery.mockResolvedValue({
        assignments: [
          { recordId: 'r1', state: 'a-state-from-the-future', workflowRunId: 1, runState: null },
          { recordId: 'r2', state: 'doing', workflowRunId: 2, runState: 'started' },
        ],
      });

      await expect(port.listAssignments('inbox-1')).resolves.toHaveLength(2);
    });
  });

  describe('sync', () => {
    it('should post both lists and return the per-record outcomes', async () => {
      mockQuery.mockResolvedValue({
        results: [
          { recordId: 'r1', outcome: 'started' },
          { recordId: 'r2', outcome: 'escalated' },
        ],
      });
      const body = {
        closed: [{ recordId: 'r2', stillInSegment: true }],
        candidates: ['r1'],
      };

      await expect(port.sync('inbox-1', body)).resolves.toEqual([
        { recordId: 'r1', outcome: 'started' },
        { recordId: 'r2', outcome: 'escalated' },
      ]);
      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'post',
        '/api/workflow-orchestrator/automated-inboxes/inbox-1/sync',
        {},
        body,
      );
    });

    it('should report an inbox the orchestrator no longer serves', async () => {
      mockQuery.mockRejectedValue(httpError(404));

      await expect(port.sync('inbox-1', { closed: [], candidates: [] })).rejects.toThrow(
        AutomatedInboxGoneError,
      );
    });
  });
});
