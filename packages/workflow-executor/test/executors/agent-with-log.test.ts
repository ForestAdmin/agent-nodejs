import type { AgentWithLogDeps } from '../../src/executors/agent-with-log';
import type { AgentPort } from '../../src/ports/agent-port';
import type SchemaResolver from '../../src/schema-resolver';
import type { StepUser } from '../../src/types/execution-context';
import type { CollectionSchema } from '../../src/types/validated/collection';

import activityLogContext from './activity-log-context';
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

function makeSchema(fields: CollectionSchema['fields'] = []): CollectionSchema {
  return {
    collectionName: 'customers',
    collectionId: 'col-customers',
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

function makeDeps(overrides: Partial<AgentWithLogDeps> = {}) {
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
    executeAction: jest.fn().mockResolvedValue({ result: { ok: true } }),
    getActionFormInfo: jest.fn().mockResolvedValue({ hasForm: true }),
    getActionForm: jest.fn(),
  } as unknown as jest.Mocked<AgentPort>;
  const schemaResolver = {
    resolve: jest.fn().mockResolvedValue(makeSchema([makeRelationField('order', 'Order')])),
  } as unknown as SchemaResolver;

  return {
    agentPort,
    schemaResolver,
    user: makeUser(),
    activityLog: activityLogContext(),
    ...overrides,
  };
}

const relatedSchema = makeSchema();

describe('AgentWithLog', () => {
  describe('read methods', () => {
    it("runs getRecord under the step's activity log and returns the data", async () => {
      const deps = makeDeps();
      const query = { collection: 'customers', id: [42] };

      const result = await new AgentWithLog(deps).getRecord(query);

      expect(deps.agentPort.getRecord).toHaveBeenCalledWith(query, deps.user, {
        context: deps.activityLog,
      });
      expect(result).toEqual({ collectionName: 'customers', recordId: [42], values: {} });
    });

    it('labels getRelatedData with the relation displayName', async () => {
      const deps = makeDeps();
      const query = {
        collection: 'customers',
        id: [42],
        relation: 'order',
        relatedSchema,
        limit: null,
      };

      await new AgentWithLog(deps).getRelatedData(query);

      expect(deps.agentPort.getRelatedData).toHaveBeenCalledWith(query, deps.user, {
        context: deps.activityLog,
        call: { label: 'list relation "Order"' },
      });
    });

    it('names getSingleRelatedData listRelatedData, labelled with the relation displayName', async () => {
      const deps = makeDeps();
      const query = { collection: 'customers', id: [42], relation: 'order', relatedSchema };

      await new AgentWithLog(deps).getSingleRelatedData(query);

      expect(deps.agentPort.getSingleRelatedData).toHaveBeenCalledWith(query, deps.user, {
        context: deps.activityLog,
        call: { action: 'listRelatedData', label: 'list relation "Order"' },
      });
    });

    it('falls back to the technical relation name when the field is absent from the schema', async () => {
      const deps = makeDeps();
      const query = { collection: 'customers', id: [42], relation: 'invoice', relatedSchema };

      await new AgentWithLog(deps).getSingleRelatedData(query);

      expect(deps.agentPort.getSingleRelatedData).toHaveBeenCalledWith(query, deps.user, {
        context: deps.activityLog,
        call: { action: 'listRelatedData', label: 'list relation "invoice"' },
      });
    });
  });

  describe('write methods', () => {
    it("hands updateRecord the step's write-ahead marker", async () => {
      const deps = makeDeps();
      const beforeCall = jest.fn().mockResolvedValue(undefined);
      const query = { collection: 'customers', id: [42], values: { status: 'active' } };

      await new AgentWithLog(deps).updateRecord(query, { beforeCall });

      expect(deps.agentPort.updateRecord).toHaveBeenCalledWith(query, deps.user, {
        context: deps.activityLog,
        call: { beforeCall },
      });
    });

    it('hands executeAction the marker and the forest server token', async () => {
      const deps = makeDeps({ forestServerToken: 'forest-token' });
      const beforeCall = jest.fn().mockResolvedValue(undefined);
      const query = { collection: 'customers', action: 'refund', id: [42] };

      const result = await new AgentWithLog(deps).executeAction(query, { beforeCall });

      expect(deps.agentPort.executeAction).toHaveBeenCalledWith(
        query,
        { user: deps.user, forestServerToken: 'forest-token' },
        { context: deps.activityLog, call: { beforeCall } },
      );
      expect(result).toEqual({ result: { ok: true } });
    });
  });

  describe('unaudited passthroughs', () => {
    it('forwards getActionFormInfo with the step user only', async () => {
      const deps = makeDeps();
      const query = { collection: 'customers', action: 'refund', id: [42] };

      await new AgentWithLog(deps).getActionFormInfo(query);

      expect(deps.agentPort.getActionFormInfo).toHaveBeenCalledWith(query, deps.user);
    });

    it('forwards resolvePolymorphicType with the step user only', async () => {
      const deps = makeDeps();
      const query = { collection: 'comments', id: [1], relation: 'commentable' };

      const result = await new AgentWithLog(deps).resolvePolymorphicType(query);

      expect(deps.agentPort.resolvePolymorphicType).toHaveBeenCalledWith(query, deps.user);
      expect(result).toEqual({ type: 'orders', id: '99' });
    });
  });
});
