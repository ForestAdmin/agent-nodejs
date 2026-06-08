import type { AgentWithLogDeps } from '../../src/executors/agent-with-log';
import type { AgentPort } from '../../src/ports/agent-port';
import type SchemaResolver from '../../src/schema-resolver';
import type { StepUser } from '../../src/types/execution-context';
import type { CollectionSchema } from '../../src/types/validated/collection';

import ActivityLog from '../../src/executors/activity-log';
import AgentWithLog from '../../src/executors/agent-with-log';

function makeUser(): StepUser {
  return {
    id: 1,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    team: 'admin',
    renderingId: 1,
    role: 'admin',
    permissionLevel: 'admin',
    tags: {},
  } as StepUser;
}

function makeSchema(collectionId = 'col-customers'): CollectionSchema {
  return {
    collectionName: 'customers',
    collectionId,
    collectionDisplayName: 'Customers',
    primaryKeyFields: ['id'],
    referenceField: null,
    fields: [],
    actions: [],
  };
}

function makeActivityLogPort() {
  return {
    createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
    markSucceeded: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  };
}

function makeDeps(overrides: Partial<AgentWithLogDeps> = {}) {
  const activityLogPort = makeActivityLogPort();
  const agentPort = {
    getRecord: jest
      .fn()
      .mockResolvedValue({ collectionName: 'customers', recordId: [42], values: {} }),
    updateRecord: jest
      .fn()
      .mockResolvedValue({ collectionName: 'customers', recordId: [42], values: {} }),
    getRelatedData: jest.fn().mockResolvedValue([]),
    getSingleRelatedData: jest.fn().mockResolvedValue(null),
    executeAction: jest.fn().mockResolvedValue({ ok: true }),
    getActionFormInfo: jest.fn().mockResolvedValue({ hasForm: true }),
  } as unknown as AgentPort;
  const schemaResolver = {
    resolve: jest.fn().mockResolvedValue(makeSchema()),
  } as unknown as SchemaResolver;

  const deps = {
    agentPort,
    schemaResolver,
    user: makeUser(),
    activityLog: new ActivityLog(activityLogPort, makeUser()),
    ...overrides,
  };

  return { deps, agentPort, activityLogPort, schemaResolver };
}

describe('AgentWithLog', () => {
  describe('read methods', () => {
    it('logs getRecord as index/read against the call target and returns the data', async () => {
      const { deps, agentPort, activityLogPort } = makeDeps();
      const agent = new AgentWithLog(deps);

      const result = await agent.getRecord({ collection: 'customers', id: [42], fields: ['name'] });

      expect(activityLogPort.createPending).toHaveBeenCalledWith({
        renderingId: 1,
        action: 'index',
        type: 'read',
        collectionId: 'col-customers',
        recordId: [42],
      });
      expect(activityLogPort.markSucceeded).toHaveBeenCalledWith({ id: 'log-1', index: '0' });
      expect(agentPort.getRecord).toHaveBeenCalledWith(
        { collection: 'customers', id: [42], fields: ['name'] },
        expect.objectContaining({ id: 1 }),
      );
      expect(result).toEqual({ collectionName: 'customers', recordId: [42], values: {} });
    });

    it('logs getRelatedData as listRelatedData/read', async () => {
      const { deps, activityLogPort } = makeDeps();
      const agent = new AgentWithLog(deps);

      await agent.getRelatedData({
        collection: 'customers',
        id: [42],
        relation: 'orders',
        relatedSchema: makeSchema('col-orders'),
        limit: 50,
      });

      expect(activityLogPort.createPending).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'listRelatedData', type: 'read', recordId: [42] }),
      );
    });

    it('logs getSingleRelatedData as listRelatedData/read (xToOne)', async () => {
      const { deps, activityLogPort } = makeDeps();
      const agent = new AgentWithLog(deps);

      await agent.getSingleRelatedData({
        collection: 'customers',
        id: [42],
        relation: 'order',
        relatedSchema: makeSchema('col-orders'),
      });

      expect(activityLogPort.createPending).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'listRelatedData', type: 'read', recordId: [42] }),
      );
    });
  });

  describe('write methods', () => {
    it('logs updateRecord as update/write and forwards beforeCall before the side effect', async () => {
      const order: string[] = [];
      const { deps, agentPort, activityLogPort } = makeDeps();
      (agentPort.updateRecord as jest.Mock).mockImplementation(async () => {
        order.push('updateRecord');

        return { collectionName: 'customers', recordId: [42], values: {} };
      });
      const agent = new AgentWithLog(deps);

      await agent.updateRecord(
        { collection: 'customers', id: [42], values: { name: 'X' } },
        {
          beforeCall: async () => {
            order.push('beforeCall');
          },
        },
      );

      expect(order).toEqual(['beforeCall', 'updateRecord']);
      expect(activityLogPort.createPending).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', type: 'write', recordId: [42] }),
      );
    });

    it('logs executeAction as action/write', async () => {
      const { deps, activityLogPort } = makeDeps();
      const agent = new AgentWithLog(deps);

      await agent.executeAction(
        { collection: 'customers', action: 'send-email', id: [42] },
        { beforeCall: async () => undefined },
      );

      expect(activityLogPort.createPending).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'action', type: 'write', recordId: [42] }),
      );
    });
  });

  describe('getActionFormInfo (unaudited passthrough)', () => {
    it('forwards to the agent port with the injected user and emits no activity log', async () => {
      const { deps, agentPort, activityLogPort } = makeDeps();
      const agent = new AgentWithLog(deps);

      const result = await agent.getActionFormInfo({
        collection: 'customers',
        action: 'send-email',
        id: [42],
      });

      expect(agentPort.getActionFormInfo).toHaveBeenCalledWith(
        { collection: 'customers', action: 'send-email', id: [42] },
        expect.objectContaining({ id: 1 }),
      );
      expect(result).toEqual({ hasForm: true });
      expect(activityLogPort.createPending).not.toHaveBeenCalled();
    });
  });
});
