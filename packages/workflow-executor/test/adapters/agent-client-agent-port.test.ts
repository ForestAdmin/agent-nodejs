import type { StepUser } from '../../src/types/execution';
import type { CollectionSchema } from '../../src/types/record';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

import AgentClientAgentPort from '../../src/adapters/agent-client-agent-port';
import { RecordNotFoundError } from '../../src/errors';

jest.mock('@forestadmin/agent-client', () => ({
  createRemoteAgentClient: jest.fn(),
}));

const mockedCreateRemoteAgentClient = createRemoteAgentClient as jest.MockedFunction<
  typeof createRemoteAgentClient
>;

function createMockClient() {
  const mockAction = { execute: jest.fn() };
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

    const schemaCache = new Map<string, CollectionSchema>([
      [
        'users',
        {
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
        },
      ],
      [
        'orders',
        {
          collectionName: 'orders',
          collectionDisplayName: 'Orders',
          primaryKeyFields: ['tenantId', 'orderId'],
          fields: [
            { fieldName: 'tenantId', displayName: 'Tenant', isRelationship: false },
            { fieldName: 'orderId', displayName: 'Order', isRelationship: false },
          ],
          actions: [],
        },
      ],
      [
        'posts',
        {
          collectionName: 'posts',
          collectionDisplayName: 'Posts',
          primaryKeyFields: ['id'],
          fields: [
            { fieldName: 'id', displayName: 'id', isRelationship: false },
            { fieldName: 'title', displayName: 'title', isRelationship: false },
          ],
          actions: [],
        },
      ],
    ]);

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

  describe('updateRecord', () => {
    it('should call update with pipe-encoded id and return a RecordData', async () => {
      mockCollection.update.mockResolvedValue({ id: 42, name: 'Bob' });

      const result = await port.updateRecord(
        {
          collection: 'users',
          id: [42],
          values: { name: 'Bob' },
        },
        user,
      );

      expect(mockCollection.update).toHaveBeenCalledWith('42', { name: 'Bob' });
      expect(result).toEqual({
        collectionName: 'users',
        recordId: [42],
        values: { id: 42, name: 'Bob' },
      });
    });

    it('should encode composite PK to pipe format for update', async () => {
      mockCollection.update.mockResolvedValue({ tenantId: 1, orderId: 2 });

      await port.updateRecord(
        { collection: 'orders', id: [1, 2], values: { status: 'done' } },
        user,
      );

      expect(mockCollection.update).toHaveBeenCalledWith('1|2', { status: 'done' });
    });
  });

  describe('getRelatedData', () => {
    it('should return RecordData[] with recordId extracted from PK fields', async () => {
      mockRelation.list.mockResolvedValue([
        { id: 10, title: 'Post A' },
        { id: 11, title: 'Post B' },
      ]);

      const result = await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          limit: null,
        },
        user,
      );

      expect(mockCollection.relation).toHaveBeenCalledWith('posts', '42');
      expect(result).toEqual([
        {
          collectionName: 'posts',
          recordId: [10],
          values: { id: 10, title: 'Post A' },
        },
        {
          collectionName: 'posts',
          recordId: [11],
          values: { id: 11, title: 'Post B' },
        },
      ]);
    });

    it('should apply pagination when limit is a number', async () => {
      mockRelation.list.mockResolvedValue([{ id: 10, title: 'Post A' }]);

      await port.getRelatedData(
        { collection: 'users', id: [42], relation: 'posts', limit: 5 },
        user,
      );

      expect(mockRelation.list).toHaveBeenCalledWith(
        expect.objectContaining({ pagination: { size: 5, number: 1 } }),
      );
    });

    it('should not apply pagination when limit is null', async () => {
      mockRelation.list.mockResolvedValue([]);

      await port.getRelatedData(
        { collection: 'users', id: [42], relation: 'posts', limit: null },
        user,
      );

      expect(mockRelation.list).toHaveBeenCalledWith({});
    });

    it('should fallback to relationName when no CollectionSchema exists', async () => {
      mockRelation.list.mockResolvedValue([{ id: 1 }]);

      const result = await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'unknownRelation',
          limit: null,
        },
        user,
      );

      expect(result[0].collectionName).toBe('unknownRelation');
      expect(result[0].recordId).toEqual([1]);
    });

    it('should return an empty array when no related data exists', async () => {
      mockRelation.list.mockResolvedValue([]);

      expect(
        await port.getRelatedData(
          {
            collection: 'users',
            id: [42],
            relation: 'posts',
            limit: null,
          },
          user,
        ),
      ).toEqual([]);
    });

    it('should forward fields to the list call when provided', async () => {
      mockRelation.list.mockResolvedValue([{ id: 10, title: 'Post A' }]);

      await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          limit: null,
          fields: ['title'],
        },
        user,
      );

      expect(mockRelation.list).toHaveBeenCalledWith(
        expect.objectContaining({ fields: ['title'] }),
      );
    });

    it('should omit fields from the list call when not provided', async () => {
      mockRelation.list.mockResolvedValue([{ id: 10 }]);

      await port.getRelatedData(
        { collection: 'users', id: [42], relation: 'posts', limit: null },
        user,
      );

      expect(mockRelation.list).toHaveBeenCalledWith(
        expect.not.objectContaining({ fields: expect.anything() }),
      );
    });
  });

  describe('executeAction', () => {
    it('should encode ids to pipe format and call execute', async () => {
      mockAction.execute.mockResolvedValue({ success: 'done' });

      const result = await port.executeAction(
        {
          collection: 'users',
          action: 'sendEmail',
          id: [1],
        },
        user,
      );

      expect(mockCollection.action).toHaveBeenCalledWith('sendEmail', { recordIds: ['1'] });
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
});
