import type { StepUser } from '../../src/types/execution-context';

import { createRemoteAgentClient } from '@forestadmin/agent-client';
import jsonwebtoken from 'jsonwebtoken';

import AgentClientAgentPort from '../../src/adapters/agent-client-agent-port';
import { AgentProbeError, RecordNotFoundError } from '../../src/errors';
import SchemaCache from '../../src/schema-cache';

jest.mock('@forestadmin/agent-client', () => ({
  createRemoteAgentClient: jest.fn(),
}));

const mockedCreateRemoteAgentClient = createRemoteAgentClient as jest.MockedFunction<
  typeof createRemoteAgentClient
>;

function createMockClient() {
  const mockAction = { execute: jest.fn(), getFields: jest.fn().mockReturnValue([]) };
  const mockRelation = { list: jest.fn() };
  const mockCollection = {
    list: jest.fn(),
    update: jest.fn(),
    relation: jest.fn().mockReturnValue(mockRelation),
    action: jest.fn().mockResolvedValue(mockAction),
  };

  const client = {
    collection: jest.fn().mockReturnValue(mockCollection),
  };

  return { client, mockCollection, mockRelation, mockAction };
}

describe('AgentClientAgentPort', () => {
  let mockCollection: ReturnType<typeof createMockClient>['mockCollection'];
  let mockRelation: ReturnType<typeof createMockClient>['mockRelation'];
  let mockAction: ReturnType<typeof createMockClient>['mockAction'];
  let user: StepUser;
  let port: AgentClientAgentPort;

  beforeEach(() => {
    jest.clearAllMocks();

    const mocks = createMockClient();
    ({ mockCollection, mockRelation, mockAction } = mocks);
    mockedCreateRemoteAgentClient.mockReturnValue(mocks.client as any);

    const schemaCache = new SchemaCache();
    schemaCache.set('users', {
      collectionName: 'users',
      collectionDisplayName: 'Users',
      primaryKeyFields: ['id'],
      fields: [
        { fieldName: 'id', displayName: 'id', isRelationship: false },
        { fieldName: 'name', displayName: 'name', isRelationship: false },
      ],
      actions: [
        { name: 'sendEmail', displayName: 'Send Email', endpoint: '/forest/actions/sendEmail' },
        { name: 'archive', displayName: 'Archive', endpoint: '/forest/actions/archive' },
      ],
    });
    schemaCache.set('orders', {
      collectionName: 'orders',
      collectionDisplayName: 'Orders',
      primaryKeyFields: ['tenantId', 'orderId'],
      fields: [
        { fieldName: 'tenantId', displayName: 'Tenant', isRelationship: false },
        { fieldName: 'orderId', displayName: 'Order', isRelationship: false },
      ],
      actions: [],
    });
    schemaCache.set('posts', {
      collectionName: 'posts',
      collectionDisplayName: 'Posts',
      primaryKeyFields: ['id'],
      fields: [
        { fieldName: 'id', displayName: 'id', isRelationship: false },
        { fieldName: 'title', displayName: 'title', isRelationship: false },
      ],
      actions: [],
    });

    user = {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      team: 'admin',
      renderingId: 1,
      role: 'admin',
      permissionLevel: 'admin',
      tags: {},
    };

    port = new AgentClientAgentPort({
      agentUrl: 'http://localhost:3310',
      authSecret: 'test-secret',
      schemaCache,
    });
  });

  describe('getRecord', () => {
    it('should return a RecordData for a simple PK', async () => {
      mockCollection.list.mockResolvedValue([{ id: 42, name: 'Alice' }]);

      const result = await port.getRecord({ collection: 'users', id: [42] }, user);

      expect(mockCollection.list).toHaveBeenCalledWith({
        filters: { field: 'id', operator: 'Equal', value: 42 },
        pagination: { size: 1, number: 1 },
      });
      expect(result).toEqual({
        collectionName: 'users',
        recordId: [42],
        values: { id: 42, name: 'Alice' },
      });
    });

    it('should build a composite And filter for composite PKs', async () => {
      mockCollection.list.mockResolvedValue([{ tenantId: 1, orderId: 2 }]);

      await port.getRecord({ collection: 'orders', id: [1, 2] }, user);

      expect(mockCollection.list).toHaveBeenCalledWith({
        filters: {
          aggregator: 'And',
          conditions: [
            { field: 'tenantId', operator: 'Equal', value: 1 },
            { field: 'orderId', operator: 'Equal', value: 2 },
          ],
        },
        pagination: { size: 1, number: 1 },
      });
    });

    it('should throw a RecordNotFoundError when no record is found', async () => {
      mockCollection.list.mockResolvedValue([]);

      await expect(port.getRecord({ collection: 'users', id: [999] }, user)).rejects.toThrow(
        RecordNotFoundError,
      );
    });

    it('should pass fields to list when fields is provided', async () => {
      mockCollection.list.mockResolvedValue([{ id: 42, name: 'Alice' }]);

      await port.getRecord({ collection: 'users', id: [42], fields: ['id', 'name'] }, user);

      expect(mockCollection.list).toHaveBeenCalledWith({
        filters: { field: 'id', operator: 'Equal', value: 42 },
        pagination: { size: 1, number: 1 },
        fields: ['id', 'name'],
      });
    });

    it('should not pass fields to list when fields is an empty array', async () => {
      mockCollection.list.mockResolvedValue([{ id: 42, name: 'Alice' }]);

      await port.getRecord({ collection: 'users', id: [42], fields: [] }, user);

      expect(mockCollection.list).toHaveBeenCalledWith({
        filters: { field: 'id', operator: 'Equal', value: 42 },
        pagination: { size: 1, number: 1 },
      });
    });

    it('should restore snake_case field names when agent returns camelCase keys', async () => {
      // The agent-client HTTP layer deserializes JSON:API responses with camelCase keys.
      // restoreFieldNames must map them back to the original snake_case names.
      mockCollection.list.mockResolvedValue([{ cardNumber: '4111', isActive: true }]);

      const result = await port.getRecord(
        { collection: 'users', id: [42], fields: ['card_number', 'is_active'] },
        user,
      );

      expect(result.values).toEqual({ card_number: '4111', is_active: true });
    });

    it('should not pass fields to list when fields is undefined', async () => {
      mockCollection.list.mockResolvedValue([{ id: 42, name: 'Alice' }]);

      await port.getRecord({ collection: 'users', id: [42] }, user);

      expect(mockCollection.list).toHaveBeenCalledWith({
        filters: { field: 'id', operator: 'Equal', value: 42 },
        pagination: { size: 1, number: 1 },
      });
    });

    it('should fallback to pk field "id" when collection is unknown', async () => {
      mockCollection.list.mockResolvedValue([{ id: 1 }]);

      const result = await port.getRecord({ collection: 'unknown', id: [1] }, user);

      expect(mockCollection.list).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: { field: 'id', operator: 'Equal', value: 1 },
        }),
      );
      expect(result.collectionName).toBe('unknown');
    });
  });

  describe('agent JWT', () => {
    it('signs both camelCase and snake_case identity claims for cross-runtime agents', async () => {
      mockCollection.list.mockResolvedValue([{ id: 42 }]);

      await port.getRecord({ collection: 'users', id: [42] }, user);

      const { token } = mockedCreateRemoteAgentClient.mock.calls[0][0];
      const payload = jsonwebtoken.verify(token, 'test-secret') as Record<string, unknown>;

      expect(payload).toMatchObject({
        firstName: 'Test',
        lastName: 'User',
        renderingId: 1,
        permissionLevel: 'admin',
        first_name: 'Test',
        last_name: 'User',
        rendering_id: 1,
        permission_level: 'admin',
        scope: 'step-execution',
      });
    });
  });

  describe('updateRecord', () => {
    it('should forward the RecordId array to agent-client and return a RecordData', async () => {
      mockCollection.update.mockResolvedValue({ id: 42, name: 'Bob' });

      const result = await port.updateRecord(
        {
          collection: 'users',
          id: [42],
          values: { name: 'Bob' },
        },
        user,
      );

      expect(mockCollection.update).toHaveBeenCalledWith([42], { name: 'Bob' });
      expect(result).toEqual({
        collectionName: 'users',
        recordId: [42],
        values: { id: 42, name: 'Bob' },
      });
    });

    it('should forward composite PKs as arrays (agent-client handles pipe encoding)', async () => {
      mockCollection.update.mockResolvedValue({ tenantId: 1, orderId: 2 });

      await port.updateRecord(
        { collection: 'orders', id: [1, 2], values: { status: 'done' } },
        user,
      );

      expect(mockCollection.update).toHaveBeenCalledWith([1, 2], { status: 'done' });
    });

    it('should restore snake_case field names when agent returns camelCase keys', async () => {
      mockCollection.update.mockResolvedValue({ cardNumber: '4111', isActive: true });

      const result = await port.updateRecord(
        { collection: 'users', id: [42], values: { card_number: '4111', is_active: true } },
        user,
      );

      expect(result.values).toEqual({ card_number: '4111', is_active: true });
    });
  });

  describe('getRelatedData', () => {
    const postsSchema = {
      collectionName: 'posts',
      collectionDisplayName: 'Posts',
      primaryKeyFields: ['id'],
      fields: [
        { fieldName: 'id', displayName: 'id', isRelationship: false, type: 'Number' as const },
        {
          fieldName: 'title',
          displayName: 'title',
          isRelationship: false,
          type: 'String' as const,
        },
      ],
      actions: [],
    };

    it('maps raw rows to RecordData using the supplied related schema', async () => {
      mockRelation.list.mockResolvedValue([
        { id: 10, title: 'Post A' },
        { id: 11, title: 'Post B' },
      ]);

      const result = await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          relatedSchema: postsSchema,
          limit: null,
        },
        user,
      );

      expect(mockCollection.relation).toHaveBeenCalledWith('posts', [42]);
      expect(result).toEqual([
        { collectionName: 'posts', recordId: [10], values: { id: 10, title: 'Post A' } },
        { collectionName: 'posts', recordId: [11], values: { id: 11, title: 'Post B' } },
      ]);
    });

    it('restores snake_case field names from camelCase deserialized rows', async () => {
      const snakeSchema = {
        ...postsSchema,
        primaryKeyFields: ['post_id'],
        fields: [
          {
            fieldName: 'post_id',
            displayName: 'Post id',
            isRelationship: false,
            type: 'Number' as const,
          },
          {
            fieldName: 'created_at',
            displayName: 'Created at',
            isRelationship: false,
            type: 'Date' as const,
          },
        ],
      };
      mockRelation.list.mockResolvedValue([{ postId: 99, createdAt: '2024-01-01' }]);

      const result = await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          relatedSchema: snakeSchema,
          limit: null,
        },
        user,
      );

      expect(result).toEqual([
        {
          collectionName: 'posts',
          recordId: [99],
          values: { post_id: 99, created_at: '2024-01-01' },
        },
      ]);
    });

    it('extracts composite primary keys in the order declared by the schema', async () => {
      const compositeSchema = {
        ...postsSchema,
        primaryKeyFields: ['tenantId', 'postId'],
        fields: [
          {
            fieldName: 'tenantId',
            displayName: 'Tenant',
            isRelationship: false,
            type: 'String' as const,
          },
          {
            fieldName: 'postId',
            displayName: 'Post',
            isRelationship: false,
            type: 'Number' as const,
          },
        ],
      };
      mockRelation.list.mockResolvedValue([{ tenantId: 'acme', postId: 7 }]);

      const result = await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          relatedSchema: compositeSchema,
          limit: null,
        },
        user,
      );

      expect(result[0].recordId).toEqual(['acme', 7]);
    });

    it('applies pagination when limit is a number', async () => {
      mockRelation.list.mockResolvedValue([{ id: 10, title: 'Post A' }]);

      await port.getRelatedData(
        { collection: 'users', id: [42], relation: 'posts', relatedSchema: postsSchema, limit: 5 },
        user,
      );

      expect(mockRelation.list).toHaveBeenCalledWith(
        expect.objectContaining({ pagination: { size: 5, number: 1 } }),
      );
    });

    it('does not apply pagination when limit is null', async () => {
      mockRelation.list.mockResolvedValue([]);

      await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          relatedSchema: postsSchema,
          limit: null,
        },
        user,
      );

      expect(mockRelation.list).toHaveBeenCalledWith({});
    });

    it('returns an empty array when no related data exists', async () => {
      mockRelation.list.mockResolvedValue([]);

      expect(
        await port.getRelatedData(
          {
            collection: 'users',
            id: [42],
            relation: 'posts',
            relatedSchema: postsSchema,
            limit: null,
          },
          user,
        ),
      ).toEqual([]);
    });

    it('forwards fields to the list call when provided', async () => {
      mockRelation.list.mockResolvedValue([{ id: 10, title: 'Post A' }]);

      await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          relatedSchema: postsSchema,
          limit: null,
          fields: ['title'],
        },
        user,
      );

      expect(mockRelation.list).toHaveBeenCalledWith(
        expect.objectContaining({ fields: ['title'] }),
      );
    });

    it('omits fields from the list call when not provided', async () => {
      mockRelation.list.mockResolvedValue([{ id: 10 }]);

      await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          relatedSchema: postsSchema,
          limit: null,
        },
        user,
      );

      expect(mockRelation.list).toHaveBeenCalledWith(
        expect.not.objectContaining({ fields: expect.anything() }),
      );
    });
  });

  describe('getSingleRelatedData', () => {
    // xToOne relations don't expose /relationships/<relation> on the agent. The port reads
    // the parent record with a `<relation>@@@<field>` projection and unpacks the linkage
    // that jsonapi-serializer emits as a nested object on the parent.
    const ordersSchema = {
      collectionName: 'orders',
      collectionDisplayName: 'Orders',
      primaryKeyFields: ['id'],
      fields: [
        { fieldName: 'id', displayName: 'id', isRelationship: false, type: 'Number' as const },
        {
          fieldName: 'reference',
          displayName: 'Reference',
          isRelationship: false,
          type: 'String' as const,
        },
      ],
      actions: [],
    };

    it('projects the related PK on the parent and unpacks the linkage as RecordData', async () => {
      mockCollection.list.mockResolvedValue([{ order: { id: '99' } }]);

      const result = await port.getSingleRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'order',
          relatedSchema: ordersSchema,
        },
        user,
      );

      expect(mockCollection.list).toHaveBeenCalledWith(
        expect.objectContaining({ fields: ['order@@@id'] }),
      );
      expect(result).toEqual({
        collectionName: 'orders',
        recordId: ['99'],
        values: { id: '99' },
      });
    });

    it('projects only the caller field (e.g. referenceField), not the PK — the linkage id comes free', async () => {
      mockCollection.list.mockResolvedValue([{ order: { id: '99', reference: 'ORD-2026-001' } }]);

      const result = await port.getSingleRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'order',
          relatedSchema: ordersSchema,
          fields: ['reference'],
        },
        user,
      );

      // Single sub-field only: the agent can't parse `fields[order]=id,reference`.
      expect(mockCollection.list).toHaveBeenCalledWith(
        expect.objectContaining({ fields: ['order@@@reference'] }),
      );
      expect(result?.values).toEqual({ id: '99', reference: 'ORD-2026-001' });
    });

    it('projects at most one sub-field even when the caller passes several', async () => {
      mockCollection.list.mockResolvedValue([{ order: { id: '99', reference: 'ORD-2026-001' } }]);

      await port.getSingleRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'order',
          relatedSchema: ordersSchema,
          fields: ['reference', 'label'],
        },
        user,
      );

      expect(mockCollection.list).toHaveBeenCalledWith(
        expect.objectContaining({ fields: ['order@@@reference'] }),
      );
    });

    // Regression: jsonapi-serializer emits the nested linkage with camelCased attribute
    // keys (full_name → fullName). The adapter must restore those keys before returning
    // values, otherwise snake_case referenceFields silently resolve to undefined upstream.
    it('restores camelCased keys on the linkage when fields are snake_case', async () => {
      const snakeSchema = {
        ...ordersSchema,
        fields: [
          { fieldName: 'id', displayName: 'id', isRelationship: false, type: 'Number' as const },
          {
            fieldName: 'full_name',
            displayName: 'Full name',
            isRelationship: false,
            type: 'String' as const,
          },
        ],
      };
      mockCollection.list.mockResolvedValue([{ order: { id: '99', fullName: 'John Doe' } }]);

      const result = await port.getSingleRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'order',
          relatedSchema: snakeSchema,
          fields: ['full_name'],
        },
        user,
      );

      expect(result?.values).toEqual({ id: '99', full_name: 'John Doe' });
    });

    // Regression: the relation NAME itself can be snake_case (billing_address). jsonapi-serializer
    // emits the linkage under the camelCased key (billingAddress), so looking it up by the raw
    // name returned null and the relation never loaded.
    it('finds the linkage when the relation name is snake_case', async () => {
      mockCollection.list.mockResolvedValue([{ billingAddress: { id: '7|2' } }]);

      const result = await port.getSingleRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'billing_address',
          relatedSchema: { ...ordersSchema, collectionName: 'addresses' },
        },
        user,
      );

      expect(mockCollection.list).toHaveBeenCalledWith(
        expect.objectContaining({ fields: ['billing_address@@@id'] }),
      );
      expect(result).toEqual({
        collectionName: 'addresses',
        recordId: ['7', '2'],
        values: { id: '7|2' },
      });
    });

    it('splits composite PKs from the packed "id" linkage', async () => {
      const compositeSchema = {
        ...ordersSchema,
        primaryKeyFields: ['tenantId', 'orderId'],
        fields: [
          {
            fieldName: 'tenantId',
            displayName: 'Tenant',
            isRelationship: false,
            type: 'String' as const,
          },
          {
            fieldName: 'orderId',
            displayName: 'Order',
            isRelationship: false,
            type: 'Number' as const,
          },
        ],
      };
      mockCollection.list.mockResolvedValue([{ order: { id: 'acme|7' } }]);

      const result = await port.getSingleRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'order',
          relatedSchema: compositeSchema,
        },
        user,
      );

      expect(result?.recordId).toEqual(['acme', '7']);
    });

    it('returns null when the parent has no linkage to the xToOne relation', async () => {
      mockCollection.list.mockResolvedValue([{ order: null }]);

      const result = await port.getSingleRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'order',
          relatedSchema: ordersSchema,
        },
        user,
      );

      expect(result).toBeNull();
    });

    it('returns null when the linkage object is present but has no id', async () => {
      mockCollection.list.mockResolvedValue([{ order: {} }]);

      const result = await port.getSingleRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'order',
          relatedSchema: ordersSchema,
        },
        user,
      );

      expect(result).toBeNull();
    });
  });

  describe('executeAction', () => {
    it('should forward the RecordId array to agent-client and call execute', async () => {
      mockAction.execute.mockResolvedValue({ success: 'done' });

      const result = await port.executeAction(
        {
          collection: 'users',
          action: 'sendEmail',
          id: [1],
        },
        user,
      );

      expect(mockCollection.action).toHaveBeenCalledWith('sendEmail', { recordIds: [[1]] });
      expect(result).toEqual({ success: 'done' });
    });

    it('should call execute with empty recordIds when ids is not provided', async () => {
      mockAction.execute.mockResolvedValue(undefined);

      await port.executeAction({ collection: 'users', action: 'archive' }, user);

      expect(mockCollection.action).toHaveBeenCalledWith('archive', { recordIds: [] });
      expect(mockAction.execute).toHaveBeenCalled();
    });

    it('should propagate errors from action execution', async () => {
      mockAction.execute.mockRejectedValue(new Error('Action failed'));

      await expect(
        port.executeAction({ collection: 'users', action: 'sendEmail', id: [1] }, user),
      ).rejects.toThrow('Action failed');
    });
  });

  describe('getActionFormInfo', () => {
    it('returns hasForm:false when agent-client reports no fields', async () => {
      mockAction.getFields.mockReturnValue([]);

      const result = await port.getActionFormInfo(
        { collection: 'users', action: 'sendEmail', id: [1] },
        user,
      );

      expect(mockCollection.action).toHaveBeenCalledWith('sendEmail', { recordIds: [[1]] });
      expect(result).toEqual({ hasForm: false });
    });

    it('returns hasForm:true when agent-client reports at least one field', async () => {
      mockAction.getFields.mockReturnValue([{ getName: () => 'reason' }]);

      const result = await port.getActionFormInfo(
        { collection: 'users', action: 'sendEmail', id: [1] },
        user,
      );

      expect(result).toEqual({ hasForm: true });
    });

    it('forwards composite ids as arrays (agent-client handles pipe encoding)', async () => {
      mockAction.getFields.mockReturnValue([]);

      await port.getActionFormInfo(
        { collection: 'users', action: 'sendEmail', id: [1, 'abc'] },
        user,
      );

      expect(mockCollection.action).toHaveBeenCalledWith('sendEmail', { recordIds: [[1, 'abc']] });
    });
  });

  describe('buildActionEndpoints', () => {
    it('passes fields and hooks from schema to agent-client (supports Ruby agent fallback)', async () => {
      const schemaCache = new SchemaCache();
      schemaCache.set('users', {
        collectionName: 'users',
        collectionDisplayName: 'Users',
        primaryKeyFields: ['id'],
        fields: [{ fieldName: 'id', displayName: 'id', isRelationship: false }],
        actions: [
          {
            name: 'refund',
            displayName: 'Refund',
            endpoint: '/forest/actions/refund',
            hooks: { load: true, change: ['amount'] },
            fields: [{ field: 'amount', type: 'Number', isRequired: true }],
          },
        ],
      });
      const customPort = new AgentClientAgentPort({
        agentUrl: 'http://localhost:3310',
        authSecret: 'secret',
        schemaCache,
      });

      await customPort.executeAction({ collection: 'users', action: 'refund', id: [1] }, user);

      expect(mockedCreateRemoteAgentClient).toHaveBeenCalledWith(
        expect.objectContaining({
          actionEndpoints: {
            users: {
              refund: expect.objectContaining({
                name: 'refund',
                endpoint: '/forest/actions/refund',
                hooks: { load: true, change: ['amount'] },
                fields: [{ field: 'amount', type: 'Number', isRequired: true }],
              }),
            },
          },
        }),
      );
    });

    it('falls back to neutral hooks/fields when the schema omits them', async () => {
      // Default schema in beforeEach has no hooks/fields on actions.
      await port.executeAction({ collection: 'users', action: 'sendEmail', id: [1] }, user);

      expect(mockedCreateRemoteAgentClient).toHaveBeenCalledWith(
        expect.objectContaining({
          actionEndpoints: expect.objectContaining({
            users: expect.objectContaining({
              sendEmail: expect.objectContaining({
                hooks: { load: false, change: [] },
                fields: [],
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('probe', () => {
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(jest.fn());
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('resolves when the agent returns 200 at GET /forest/', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

      await expect(port.probe()).resolves.toBeUndefined();

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3310/forest/',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('throws when the agent responds with 404 (wrong URL / not a Forest agent)', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 404, statusText: 'Not Found' }));

      await expect(port.probe()).rejects.toThrow(AgentProbeError);
      await expect(port.probe()).rejects.toThrow(/404.*Not Found/);
    });

    it('throws when the agent responds with 401 (reverse proxy auth / wrong host)', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 401, statusText: 'Unauthorized' }));

      await expect(port.probe()).rejects.toThrow(AgentProbeError);
      await expect(port.probe()).rejects.toThrow(/401.*Unauthorized/);
    });

    it('throws AgentProbeError with status when the agent responds with 5xx', async () => {
      fetchSpy.mockResolvedValue(
        new Response(null, { status: 503, statusText: 'Service Unavailable' }),
      );

      await expect(port.probe()).rejects.toThrow(AgentProbeError);
      await expect(port.probe()).rejects.toThrow(/503.*Service Unavailable/);
    });

    it('throws AgentProbeError with "cannot reach" when fetch throws and chains the cause', async () => {
      const underlying = new TypeError('fetch failed');
      fetchSpy.mockRejectedValue(underlying);

      await expect(port.probe()).rejects.toThrow(AgentProbeError);
      await expect(port.probe()).rejects.toThrow(/cannot reach.*fetch failed/);

      let caughtCause: unknown;

      try {
        await port.probe();
      } catch (error) {
        caughtCause = (error as AgentProbeError).cause;
      }

      expect(caughtCause).toBe(underlying);
    });

    it('throws AgentProbeError with "timeout" when fetch is aborted by the signal', async () => {
      const abortError = new Error('This operation was aborted');
      abortError.name = 'TimeoutError';
      fetchSpy.mockRejectedValue(abortError);

      await expect(port.probe()).rejects.toThrow(AgentProbeError);
      await expect(port.probe()).rejects.toThrow(/timeout after 5000ms/);
    });

    it('passes an AbortSignal with 5s timeout to fetch', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

      await port.probe();

      const fetchCall = fetchSpy.mock.calls[0];
      expect(fetchCall[1]?.signal).toBeInstanceOf(AbortSignal);
    });
  });
});
