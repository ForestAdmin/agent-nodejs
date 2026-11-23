import type { ActivityLogContext } from '../../src/activity-log/with-activity-log';
import type { ActionEndpointsByCollection } from '../../src/domains/action';
import type HttpRequester from '../../src/http-requester';
import type { ActivityLogsServiceInterface } from '@forestadmin/forestadmin-client';

import { drainActivityLogs } from '../../src/activity-log/with-activity-log';
import Collection from '../../src/domains/collection';
import AgentHttpError, { ActionRequiresApprovalError } from '../../src/errors';

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

    it('should open no entry when only the form is loaded', async () => {
      const { collection, service } = setup();

      await collection.action('refund');

      expect(service.createMcpActivityLog).not.toHaveBeenCalled();
    });
  });
});
