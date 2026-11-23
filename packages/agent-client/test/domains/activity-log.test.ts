import type { ActivityLogContext } from '../../src/activity-log/with-activity-log';
import type { ActionEndpointsByCollection } from '../../src/domains/action';
import type HttpRequester from '../../src/http-requester';
import type { ActivityLogsServiceInterface } from '@forestadmin/forestadmin-client';

import { drainActivityLogs } from '../../src/activity-log/with-activity-log';
import Collection from '../../src/domains/collection';
import AgentHttpError, {
  ActionRequiresApprovalError,
  ApprovalRequestCreationError,
} from '../../src/errors';

const ACTIVITY_LOG = { id: 'log-1', attributes: { index: 'idx' } };

const actionEndpoints = {
  users: {
    refund: {
      name: 'refund',
      endpoint: '/forest/actions/refund',
      id: 'users-refund',
      hooks: { load: false, change: [] },
      fields: [],
      layout: [],
    },
  },
} as unknown as ActionEndpointsByCollection;

function setup() {
  const query = jest.fn().mockResolvedValue({});
  const service = {
    createActivityLog: jest.fn(async () => ACTIVITY_LOG),
    createMcpActivityLog: jest.fn<Promise<typeof ACTIVITY_LOG>, [unknown]>(
      async () => ACTIVITY_LOG,
    ),
    updateActivityLogStatus: jest.fn(async () => undefined),
  };
  const context: ActivityLogContext = {
    service: service as unknown as ActivityLogsServiceInterface,
    credentials: () => ({ forestServerToken: 'server-token', renderingId: 1 }),
  };
  const httpRequester = { query, stream: jest.fn() } as unknown as HttpRequester;
  const collection = new Collection('users', httpRequester, actionEndpoints, undefined, context);

  const entries = () =>
    service.createMcpActivityLog.mock.calls.map(([params]) => {
      const { action, type, collectionName, recordIds, label } = params as Record<string, unknown>;

      return { action, type, collectionName, recordIds, label };
    });

  return { query, service, collection, httpRequester, entries };
}

describe('activity logging inside agent-client calls', () => {
  afterEach(async () => {
    await drainActivityLogs();
  });

  it('should log nothing when the client is built without a context', async () => {
    const { httpRequester, service } = setup();
    const collection = new Collection('users', httpRequester, actionEndpoints);

    await collection.list();
    await collection.update(1, { name: 'a' });

    expect(service.createMcpActivityLog).not.toHaveBeenCalled();
  });

  describe('list', () => {
    it.each([
      ['index', undefined],
      ['index', { filters: {} }],
      ['index', { search: '   ' }],
      ['search', { search: 'ada' }],
      ['filter', { filters: { field: 'id', operator: 'Equal', value: 1 } }],
    ])('should log %s for %j', async (action, options) => {
      const { collection, entries } = setup();

      await collection.list(options as never);

      expect(entries()).toEqual([
        { action, type: 'read', collectionName: 'users', recordIds: undefined, label: undefined },
      ]);
    });
  });

  it('should open no entry for a count', async () => {
    const { collection, service } = setup();

    await collection.count();

    expect(service.createMcpActivityLog).not.toHaveBeenCalled();
  });

  describe('listAndCount', () => {
    it('should log one entry for the list and its count', async () => {
      const { collection, query, entries } = setup();
      query.mockImplementation(async ({ path }) => (path.endsWith('/count') ? { count: 3 } : []));

      await expect(collection.listAndCount({ search: 'ada' })).resolves.toEqual({
        records: [],
        totalCount: 3,
      });
      expect(entries()).toEqual([
        {
          action: 'search',
          type: 'read',
          collectionName: 'users',
          recordIds: undefined,
          label: undefined,
        },
      ]);
    });

    it('should send the list and its count without waiting for each other', async () => {
      const { collection, query } = setup();
      const pending: (() => void)[] = [];
      query.mockImplementation(
        ({ path }) =>
          new Promise(resolve => {
            pending.push(() => resolve(path.endsWith('/count') ? { count: 0 } : []));
          }),
      );

      const run = collection.listAndCount();
      await new Promise(setImmediate);

      expect(query).toHaveBeenCalledTimes(2);
      pending.forEach(release => release());
      await run;
    });

    it('should mark the entry failed when the count fails after the list answered', async () => {
      const { collection, query, service } = setup();
      query.mockImplementation(async ({ path }) => {
        if (path.endsWith('/count')) throw new Error('count failed');

        return [];
      });

      await expect(collection.listAndCount()).rejects.toThrow('count failed');
      await drainActivityLogs();

      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });
  });

  it('should log a getOne as an index of that record', async () => {
    const { collection, entries } = setup();

    await collection.getOne(['tenant', 7]);

    expect(entries()).toEqual([
      {
        action: 'index',
        type: 'read',
        collectionName: 'users',
        recordIds: ['tenant|7'],
        label: undefined,
      },
    ]);
  });

  it('should let a getOne name its entry', async () => {
    const { collection, entries } = setup();

    await collection.getOne(7, undefined, {
      activityLog: { action: 'listRelatedData', label: 'list relation "Owner"' },
    });

    expect(entries()).toEqual([
      {
        action: 'listRelatedData',
        type: 'read',
        collectionName: 'users',
        recordIds: ['7'],
        label: 'list relation "Owner"',
      },
    ]);
  });

  it('should let a getOne skip its entry', async () => {
    const { collection, service, query } = setup();

    await collection.getOne(7, undefined, { activityLog: { skip: true } });

    expect(service.createMcpActivityLog).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'create',
      (c: Collection) => c.create({ name: 'a' }),
      { action: 'create', recordIds: undefined, label: 'created' },
    ],
    [
      'update',
      (c: Collection) => c.update(3, { name: 'a' }),
      { action: 'update', recordIds: ['3'], label: 'updated' },
    ],
    [
      'delete',
      (c: Collection) => c.delete([3, 4]),
      { action: 'delete', recordIds: ['3', '4'], label: 'deleted' },
    ],
  ])('should log a %s as a write', async (_, call, expected) => {
    const { collection, entries } = setup();

    await call(collection);

    expect(entries()).toEqual([{ ...expected, type: 'write', collectionName: 'users' }]);
  });

  it('should run the hook of an update after the pending log and before the agent call', async () => {
    const { collection, service, query } = setup();
    const order: string[] = [];
    service.createMcpActivityLog.mockImplementation(async () => {
      order.push('log');

      return ACTIVITY_LOG;
    });
    query.mockImplementation(async () => {
      order.push('agent');

      return {};
    });

    await collection.update(
      3,
      { name: 'a' },
      {
        beforeCall: async () => {
          order.push('hook');
        },
      },
    );

    expect(order).toEqual(['log', 'hook', 'agent']);
  });

  it('should not call the agent for a write whose log cannot be created', async () => {
    const { collection, service, query } = setup();
    service.createMcpActivityLog.mockRejectedValue(new Error('down'));

    await expect(collection.update(3, { name: 'a' })).rejects.toMatchObject({
      reason: 'unavailable',
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('should open no entry for capabilities unless the call names one', async () => {
    const { collection, entries, query } = setup();
    query.mockResolvedValue({ collections: [{ name: 'users', fields: [] }] });

    await collection.capabilities();
    await collection.capabilities({ action: 'describeCollection' });

    expect(entries()).toEqual([
      {
        action: 'describeCollection',
        type: 'read',
        collectionName: 'users',
        recordIds: undefined,
        label: undefined,
      },
    ]);
  });

  describe('relation', () => {
    it('should log a list as listRelatedData on the parent record', async () => {
      const { collection, entries } = setup();

      await collection.relation('posts', 9).list();

      expect(entries()).toEqual([
        {
          action: 'listRelatedData',
          type: 'read',
          collectionName: 'users',
          recordIds: ['9'],
          label: 'list relation "posts"',
        },
      ]);
    });

    it.each([
      [
        { search: 'hello', filters: { field: 'title', operator: 'Present' } },
        ' with search and filter',
      ],
      [{ search: 'hello' }, ' with search'],
      [{ search: '   ', filters: { field: 'title', operator: 'Present' } }, ' with filter'],
      [{ search: '   ', filters: {} }, ''],
    ])('should label a list with the refinements %j really applies', async (options, suffix) => {
      const { collection, entries } = setup();

      await collection.relation('posts', 9).list(options as never);

      expect(entries()).toEqual([
        expect.objectContaining({ label: `list relation "posts"${suffix}` }),
      ]);
    });

    it('should open no entry for a count', async () => {
      const { collection, service } = setup();

      await collection.relation('posts', 9).count();

      expect(service.createMcpActivityLog).not.toHaveBeenCalled();
    });

    it('should log one listRelatedData entry for a list and its count, failed when the count fails', async () => {
      const { collection, query, service, entries } = setup();
      query.mockImplementation(async ({ path }) => {
        if (path.endsWith('/count')) throw new Error('count failed');

        return [];
      });

      await expect(collection.relation('posts', 9).listAndCount()).rejects.toThrow('count failed');
      await drainActivityLogs();

      expect(entries()).toEqual([
        expect.objectContaining({ action: 'listRelatedData', recordIds: ['9'] }),
      ]);
      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should log associate and dissociate as updates of the parent record', async () => {
      const { collection, entries } = setup();
      const relation = collection.relation('posts', 9);

      await relation.associate(5);
      await relation.dissociate([5, 6]);

      expect(entries()).toEqual([
        {
          action: 'update',
          type: 'write',
          collectionName: 'users',
          recordIds: ['9'],
          label: 'associate "posts" with record 5',
        },
        {
          action: 'update',
          type: 'write',
          collectionName: 'users',
          recordIds: ['9'],
          label: 'dissociate "posts" from 2 record(s)',
        },
      ]);
    });
  });

  describe('executeAction', () => {
    it('should open the entry before resolving the action and run every step in order', async () => {
      const { collection, service, query } = setup();
      const order: string[] = [];
      service.createMcpActivityLog.mockImplementation(async () => {
        order.push('log');

        return ACTIVITY_LOG;
      });
      query.mockImplementation(async () => {
        order.push('execute');

        return { success: 'done' };
      });

      const result = await collection.executeAction('refund', {
        recordIds: [1],
        fill: async () => {
          order.push('fill');
        },
        activityLog: {
          beforeCall: async () => {
            order.push('hook');
          },
        },
      });

      expect(result).toEqual({ success: 'done' });
      expect(order).toEqual(['log', 'hook', 'fill', 'execute']);
      expect(service.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'action',
          type: 'write',
          collectionName: 'users',
          recordIds: ['1'],
          label: 'triggered the action "refund"',
        }),
      );
    });

    it('should not resolve the action when the hook refuses it', async () => {
      const { collection, query } = setup();

      await expect(
        collection.executeAction('unknown', {
          activityLog: {
            beforeCall: async () => {
              throw new Error('not allowed');
            },
          },
        }),
      ).rejects.toThrow('not allowed');
      expect(query).not.toHaveBeenCalled();
    });

    it('should mark the entry canceled when the action requires an approval', async () => {
      const { collection, service, query } = setup();
      query.mockRejectedValue(
        new AgentHttpError(403, { errors: [{ name: 'CustomActionRequiresApprovalError' }] }),
      );

      await expect(collection.executeAction('refund')).rejects.toBeInstanceOf(
        ActionRequiresApprovalError,
      );
      await drainActivityLogs();

      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'canceled' }),
      );
    });

    describe('when the action is sent for approval', () => {
      const approvalGated = new AgentHttpError(403, {
        errors: [{ name: 'CustomActionRequiresApprovalError' }],
      });

      function setupApproval(overrides: Partial<ActivityLogContext> = {}) {
        const { query, service, httpRequester, entries } = setup();
        const logger = jest.fn();
        const createApprovalRequest = jest.fn(async () => ({ id: 'req_1' }));
        let created = 0;

        const create = async () => {
          created += 1;

          return { id: `log-${created}`, attributes: { index: 'idx' } };
        };

        service.createMcpActivityLog.mockImplementation(create);
        service.createActivityLog.mockImplementation(create);
        query.mockRejectedValue(approvalGated);

        const collection = new Collection(
          'users',
          httpRequester,
          actionEndpoints,
          createApprovalRequest,
          {
            service: service as unknown as ActivityLogsServiceInterface,
            credentials: () => ({ forestServerToken: 'server-token', renderingId: 1 }),
            logger,
            ...overrides,
          },
        );

        return { collection, service, entries, logger, createApprovalRequest };
      }

      it('should cancel the action entry and write a completed createApproval entry', async () => {
        const { collection, service, entries } = setupApproval();

        const result = await collection.executeAction('refund', { recordIds: [1, 2] });
        await drainActivityLogs();

        expect(result).toEqual({ approvalRequested: true, approvalRequest: { id: 'req_1' } });
        expect(entries()).toEqual([
          {
            action: 'action',
            type: 'write',
            collectionName: 'users',
            recordIds: ['1', '2'],
            label: 'triggered the action "refund"',
          },
          {
            action: 'createApproval',
            type: 'write',
            collectionName: 'users',
            recordIds: ['1', '2'],
            label: 'requested an approval for the action "refund"',
          },
        ]);
        expect(service.updateActivityLogStatus).toHaveBeenCalledTimes(2);
        expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
          expect.objectContaining({
            activityLog: expect.objectContaining({ id: 'log-1' }),
            status: 'canceled',
          }),
        );
        expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
          expect.objectContaining({
            activityLog: expect.objectContaining({ id: 'log-2' }),
            status: 'completed',
          }),
        );
      });

      it('should write the createApproval entry by collection id and workflow run when the surface logs that way', async () => {
        const workflow = { runId: 'run-1', name: 'Onboarding' };
        const { collection, service } = setupApproval({
          collectionIdOf: async name => `id-of-${name}`,
          workflow,
        });

        await collection.executeAction('refund', { recordIds: [1] });
        await drainActivityLogs();

        expect(service.createMcpActivityLog).not.toHaveBeenCalled();
        expect(service.createActivityLog).toHaveBeenLastCalledWith(
          expect.objectContaining({
            action: 'createApproval',
            collectionName: 'id-of-users',
            recordIds: ['1'],
            workflow,
          }),
        );
      });

      it('should write no createApproval entry when the approval request could not be filed', async () => {
        const { collection, entries, createApprovalRequest } = setupApproval();
        createApprovalRequest.mockRejectedValue(new Error('the Forest server is down'));

        await expect(collection.executeAction('refund')).rejects.toBeInstanceOf(
          ApprovalRequestCreationError,
        );
        await drainActivityLogs();

        expect(entries().map(entry => entry.action)).toEqual(['action']);
      });

      it('should still answer the request id, and report it, when the createApproval entry cannot be written', async () => {
        const { collection, service, logger } = setupApproval();
        service.createMcpActivityLog
          .mockResolvedValueOnce(ACTIVITY_LOG)
          .mockRejectedValueOnce(new Error('the audit store is down'));

        const result = await collection.executeAction('refund');
        await drainActivityLogs();

        expect(result).toEqual({ approvalRequested: true, approvalRequest: { id: 'req_1' } });
        expect(logger).toHaveBeenCalledWith(
          'Error',
          'The approval request was filed, but its activity log could not be written',
          expect.objectContaining({ collectionName: 'users' }),
        );
      });

      it('should write no createApproval entry when logging is off', async () => {
        const { service, httpRequester, query } = setup();
        query.mockRejectedValue(approvalGated);
        const collection = new Collection('users', httpRequester, actionEndpoints, async () => ({
          id: 'req_1',
        }));

        await collection.executeAction('refund');
        await drainActivityLogs();

        expect(service.createMcpActivityLog).not.toHaveBeenCalled();
      });
    });

    it('should open no entry when only the form is loaded', async () => {
      const { collection, service } = setup();

      await collection.action('refund');

      expect(service.createMcpActivityLog).not.toHaveBeenCalled();
    });
  });
});
