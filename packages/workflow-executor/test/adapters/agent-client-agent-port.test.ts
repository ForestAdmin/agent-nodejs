import type { CollectionRef } from '../../src/types/record';
import type { RemoteAgentClient } from '@forestadmin/agent-client';

import AgentClientAgentPort from '../../src/adapters/agent-client-agent-port';
import { RecordNotFoundError } from '../../src/errors';

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
  } as unknown as jest.Mocked<RemoteAgentClient>;

  return { client, mockCollection, mockRelation, mockAction };
}

describe('AgentClientAgentPort', () => {
  let client: jest.Mocked<RemoteAgentClient>;
  let mockCollection: ReturnType<typeof createMockClient>['mockCollection'];
  let mockRelation: ReturnType<typeof createMockClient>['mockRelation'];
  let mockAction: ReturnType<typeof createMockClient>['mockAction'];
  let collectionRefs: Record<string, CollectionRef>;
  let port: AgentClientAgentPort;

  beforeEach(() => {
    jest.clearAllMocks();

    ({ client, mockCollection, mockRelation, mockAction } = createMockClient());

    collectionRefs = {
      users: {
        collectionName: 'users',
        collectionDisplayName: 'Users',
        primaryKeyFields: ['id'],
        fields: [
          { fieldName: 'id', displayName: 'id', type: 'Number', isRelationship: false },
          { fieldName: 'name', displayName: 'name', type: 'String', isRelationship: false },
        ],
        actions: [
          { name: 'sendEmail', displayName: 'Send Email' },
          { name: 'archive', displayName: 'Archive' },
        ],
      },
      orders: {
        collectionName: 'orders',
        collectionDisplayName: 'Orders',
        primaryKeyFields: ['tenantId', 'orderId'],
        fields: [
          { fieldName: 'tenantId', displayName: 'Tenant', type: 'Number', isRelationship: false },
          { fieldName: 'orderId', displayName: 'Order', type: 'Number', isRelationship: false },
        ],
        actions: [],
      },
      posts: {
        collectionName: 'posts',
        collectionDisplayName: 'Posts',
        primaryKeyFields: ['id'],
        fields: [
          { fieldName: 'id', displayName: 'id', type: 'Number', isRelationship: false },
          { fieldName: 'title', displayName: 'title', type: 'String', isRelationship: false },
        ],
        actions: [],
      },
    };

    port = new AgentClientAgentPort({ client, collectionRefs });
  });

  describe('getRecord', () => {
    it('should return a RecordData for a simple PK', async () => {
      mockCollection.list.mockResolvedValue([{ id: 42, name: 'Alice' }]);

      const result = await port.getRecord('users', [42]);

      expect(mockCollection.list).toHaveBeenCalledWith({
        filters: { field: 'id', operator: 'Equal', value: 42 },
        pagination: { size: 1, number: 1 },
      });
      expect(result).toEqual({
        recordId: [42],
        collectionName: 'users',
        collectionDisplayName: 'Users',
        primaryKeyFields: ['id'],
        fields: collectionRefs.users.fields,
        actions: collectionRefs.users.actions,
        values: { id: 42, name: 'Alice' },
      });
    });

    it('should build a composite And filter for composite PKs', async () => {
      mockCollection.list.mockResolvedValue([{ tenantId: 1, orderId: 2 }]);

      await port.getRecord('orders', [1, 2]);

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

      await expect(port.getRecord('users', [999])).rejects.toThrow(RecordNotFoundError);
    });

    it('should fallback to pk field "id" when collection is unknown', async () => {
      mockCollection.list.mockResolvedValue([{ id: 1 }]);

      const result = await port.getRecord('unknown', [1]);

      expect(mockCollection.list).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: { field: 'id', operator: 'Equal', value: 1 },
        }),
      );
      expect(result.collectionName).toBe('unknown');
      expect(result.fields).toEqual([]);
    });
  });

  describe('updateRecord', () => {
    it('should call update with pipe-encoded id and return a RecordData', async () => {
      mockCollection.update.mockResolvedValue({ id: 42, name: 'Bob' });

      const result = await port.updateRecord('users', [42], { name: 'Bob' });

      expect(mockCollection.update).toHaveBeenCalledWith('42', { name: 'Bob' });
      expect(result).toEqual({
        recordId: [42],
        collectionName: 'users',
        collectionDisplayName: 'Users',
        primaryKeyFields: ['id'],
        fields: collectionRefs.users.fields,
        actions: collectionRefs.users.actions,
        values: { id: 42, name: 'Bob' },
      });
    });

    it('should encode composite PK to pipe format for update', async () => {
      mockCollection.update.mockResolvedValue({ tenantId: 1, orderId: 2 });

      await port.updateRecord('orders', [1, 2], { status: 'done' });

      expect(mockCollection.update).toHaveBeenCalledWith('1|2', { status: 'done' });
    });
  });

  describe('getRelatedData', () => {
    it('should return RecordData[] with recordId extracted from PK fields', async () => {
      mockRelation.list.mockResolvedValue([
        { id: 10, title: 'Post A' },
        { id: 11, title: 'Post B' },
      ]);

      const result = await port.getRelatedData('users', [42], 'posts');

      expect(mockCollection.relation).toHaveBeenCalledWith('posts', '42');
      expect(result).toEqual([
        {
          recordId: [10],
          collectionName: 'posts',
          collectionDisplayName: 'Posts',
          primaryKeyFields: ['id'],
          fields: collectionRefs.posts.fields,
          actions: collectionRefs.posts.actions,
          values: { id: 10, title: 'Post A' },
        },
        {
          recordId: [11],
          collectionName: 'posts',
          collectionDisplayName: 'Posts',
          primaryKeyFields: ['id'],
          fields: collectionRefs.posts.fields,
          actions: collectionRefs.posts.actions,
          values: { id: 11, title: 'Post B' },
        },
      ]);
    });

    it('should fallback to relationName when no CollectionRef exists', async () => {
      mockRelation.list.mockResolvedValue([{ id: 1 }]);

      const result = await port.getRelatedData('users', [42], 'unknownRelation');

      expect(result[0].collectionName).toBe('unknownRelation');
      expect(result[0].recordId).toEqual([1]);
    });

    it('should return an empty array when no related data exists', async () => {
      mockRelation.list.mockResolvedValue([]);

      expect(await port.getRelatedData('users', [42], 'posts')).toEqual([]);
    });
  });

  describe('getActions', () => {
    it('should return ActionRef[] from CollectionRef', async () => {
      expect(await port.getActions('users')).toEqual([
        { name: 'sendEmail', displayName: 'Send Email' },
        { name: 'archive', displayName: 'Archive' },
      ]);
    });

    it('should return an empty array for an unknown collection', async () => {
      expect(await port.getActions('unknown')).toEqual([]);
    });
  });

  describe('executeAction', () => {
    it('should encode recordIds to pipe format and call execute', async () => {
      mockAction.execute.mockResolvedValue({ success: 'done' });

      const result = await port.executeAction('users', 'sendEmail', [[1], [2]]);

      expect(mockCollection.action).toHaveBeenCalledWith('sendEmail', { recordIds: ['1', '2'] });
      expect(result).toEqual({ success: 'done' });
    });

    it('should propagate errors from action execution', async () => {
      mockAction.execute.mockRejectedValue(new Error('Action failed'));

      await expect(port.executeAction('users', 'sendEmail', [[1]])).rejects.toThrow(
        'Action failed',
      );
    });
  });
});
