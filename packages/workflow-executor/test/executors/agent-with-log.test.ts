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

function makeSchema(
  collectionId = 'col-customers',
  fields: CollectionSchema['fields'] = [],
): CollectionSchema {
  return {
    collectionName: 'customers',
    collectionId,
    collectionDisplayName: 'Customers',
    primaryKeyFields: ['id'],
    referenceField: null,
    fields,
    actions: [],
  };
}

function makeRelationField(
  fieldName: string,
  displayName: string,
): CollectionSchema['fields'][number] {
  return { fieldName, displayName, isRelationship: true, relationType: 'BelongsTo' };
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
    resolvePolymorphicType: jest.fn().mockResolvedValue({ type: 'orders', id: '99' }),
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

    it('logs getRelatedData as listRelatedData/read labelled with the relation displayName', async () => {
      const schema = makeSchema('col-customers', [makeRelationField('orders', 'Orders')]);
      const { deps, activityLogPort, schemaResolver } = makeDeps();
      (schemaResolver.resolve as jest.Mock).mockResolvedValue(schema);
      const agent = new AgentWithLog(deps);

      await agent.getRelatedData({
        collection: 'customers',
        id: [42],
        relation: 'orders',
        relatedSchema: makeSchema('col-orders'),
        limit: 50,
      });

      expect(activityLogPort.createPending).toHaveBeenCalledWith({
        renderingId: 1,
        action: 'listRelatedData',
        type: 'read',
        collectionId: 'col-customers',
        recordId: [42],
        label: 'list relation "Orders"',
      });
    });

    it('logs getSingleRelatedData as listRelatedData/read labelled with the relation displayName (xToOne)', async () => {
      const schema = makeSchema('col-customers', [makeRelationField('order', 'Order')]);
      const { deps, activityLogPort, schemaResolver } = makeDeps();
      (schemaResolver.resolve as jest.Mock).mockResolvedValue(schema);
      const agent = new AgentWithLog(deps);

      await agent.getSingleRelatedData({
        collection: 'customers',
        id: [42],
        relation: 'order',
        relatedSchema: makeSchema('col-orders'),
      });

      expect(activityLogPort.createPending).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'listRelatedData',
          type: 'read',
          label: 'list relation "Order"',
        }),
      );
    });

    it('falls back to the technical relation name when the field is absent from the schema', async () => {
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
        expect.objectContaining({ label: 'list relation "orders"' }),
      );
    });
  });

  describe('write methods', () => {
    it('logs updateRecord as update/write with the static "updated" label', async () => {
      const { deps, activityLogPort } = makeDeps();
      const agent = new AgentWithLog(deps);

      await agent.updateRecord(
        { collection: 'customers', id: [42], values: { name: 'X' } },
        { beforeCall: async () => undefined },
      );

      expect(activityLogPort.createPending).toHaveBeenCalledWith({
        renderingId: 1,
        action: 'update',
        type: 'write',
        collectionId: 'col-customers',
        recordId: [42],
        label: 'updated',
      });
    });

    it('logs executeAction labelled with the action technical name', async () => {
      const { deps, activityLogPort } = makeDeps();
      const agent = new AgentWithLog(deps);

      await agent.executeAction(
        { collection: 'customers', action: 'send_email', id: [42] },
        { beforeCall: async () => undefined },
      );

      expect(activityLogPort.createPending).toHaveBeenCalledWith({
        renderingId: 1,
        action: 'action',
        type: 'write',
        collectionId: 'col-customers',
        recordId: [42],
        label: 'triggered the action "send_email"',
      });
    });

    it('runs beforeCall between createPending and the agent call (audit precedes the side effect)', async () => {
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

    it('forwards the forestServerToken to the port (enables approval-request creation)', async () => {
      const { deps, agentPort } = makeDeps({ forestServerToken: 'server-token' });
      const agent = new AgentWithLog(deps);

      await agent.executeAction(
        { collection: 'customers', action: 'send-email', id: [42] },
        { beforeCall: async () => undefined },
      );

      expect(agentPort.executeAction).toHaveBeenCalledWith(
        { collection: 'customers', action: 'send-email', id: [42] },
        { user: expect.objectContaining({ id: 1 }), forestServerToken: 'server-token' },
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

  describe('resolvePolymorphicType (unaudited passthrough)', () => {
    it('forwards to the agent port with the injected user and emits no activity log', async () => {
      const { deps, agentPort, activityLogPort } = makeDeps();
      const agent = new AgentWithLog(deps);

      const result = await agent.resolvePolymorphicType({
        collection: 'comments',
        id: [7],
        relation: 'commentable',
      });

      expect(agentPort.resolvePolymorphicType).toHaveBeenCalledWith(
        { collection: 'comments', id: [7], relation: 'commentable' },
        expect.objectContaining({ id: 1 }),
      );
      expect(result).toEqual({ type: 'orders', id: '99' });
      expect(activityLogPort.createPending).not.toHaveBeenCalled();
    });
  });
});
