import type { CollectionRef } from '../../src/types/record';
import type { ActionEndpointsByCollection, RemoteAgentClient } from '@forestadmin/agent-client';

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
  let actionEndpoints: ActionEndpointsByCollection;
  let collectionRefs: Record<string, CollectionRef>;
  let port: AgentClientAgentPort;

  beforeEach(() => {
    jest.clearAllMocks();

    ({ client, mockCollection, mockRelation, mockAction } = createMockClient());

    actionEndpoints = {
      users: {
        sendEmail: { name: 'Send Email', endpoint: '/forest/actions/send-email' },
        archive: { name: 'Archive', endpoint: '/forest/actions/archive' },
      },
    };

    collectionRefs = {
      users: {
        collectionName: 'users',
        collectionDisplayName: 'Users',
        fields: [
          { fieldName: 'id', displayName: 'id', type: 'Number', isRelationship: false },
          { fieldName: 'name', displayName: 'name', type: 'String', isRelationship: false },
        ],
      },
      posts: {
        collectionName: 'posts',
        collectionDisplayName: 'Posts',
        fields: [
          { fieldName: 'id', displayName: 'id', type: 'Number', isRelationship: false },
          { fieldName: 'title', displayName: 'title', type: 'String', isRelationship: false },
        ],
      },
    };

    port = new AgentClientAgentPort({ client, actionEndpoints, collectionRefs });
  });

  describe('getRecord', () => {
    it('should return a RecordData using the provided CollectionRef', async () => {
      mockCollection.list.mockResolvedValue([{ id: '42', name: 'Alice' }]);

      const result = await port.getRecord('users', '42');

      expect(client.collection).toHaveBeenCalledWith('users');
      expect(mockCollection.list).toHaveBeenCalledWith({
        filters: { field: 'id', operator: 'Equal', value: '42' },
        pagination: { size: 1, number: 1 },
      });
      expect(result).toEqual({
        recordId: '42',
        collectionName: 'users',
        collectionDisplayName: 'Users',
        fields: collectionRefs.users.fields,
        values: { id: '42', name: 'Alice' },
      });
    });

    it('should throw a RecordNotFoundError when no record is found', async () => {
      mockCollection.list.mockResolvedValue([]);

      await expect(port.getRecord('users', '999')).rejects.toThrow(RecordNotFoundError);
      await expect(port.getRecord('users', '999')).rejects.toThrow(
        'Record not found: collection "users", id "999"',
      );
    });

    it('should fallback to empty fields when collection is unknown', async () => {
      mockCollection.list.mockResolvedValue([{ id: '1' }]);

      const result = await port.getRecord('unknown', '1');

      expect(result.collectionName).toBe('unknown');
      expect(result.collectionDisplayName).toBe('unknown');
      expect(result.fields).toEqual([]);
    });
  });

  describe('updateRecord', () => {
    it('should return a RecordData after update', async () => {
      mockCollection.update.mockResolvedValue({ id: '42', name: 'Bob' });

      const result = await port.updateRecord('users', '42', { name: 'Bob' });

      expect(mockCollection.update).toHaveBeenCalledWith('42', { name: 'Bob' });
      expect(result).toEqual({
        recordId: '42',
        collectionName: 'users',
        collectionDisplayName: 'Users',
        fields: collectionRefs.users.fields,
        values: { id: '42', name: 'Bob' },
      });
    });
  });

  describe('getRelatedData', () => {
    it('should return a RecordData array with the related CollectionRef', async () => {
      mockRelation.list.mockResolvedValue([
        { id: '10', title: 'Post A' },
        { id: '11', title: 'Post B' },
      ]);

      const result = await port.getRelatedData('users', '42', 'posts');

      expect(client.collection).toHaveBeenCalledWith('users');
      expect(mockCollection.relation).toHaveBeenCalledWith('posts', '42');
      expect(result).toEqual([
        {
          recordId: '10',
          collectionName: 'posts',
          collectionDisplayName: 'Posts',
          fields: collectionRefs.posts.fields,
          values: { id: '10', title: 'Post A' },
        },
        {
          recordId: '11',
          collectionName: 'posts',
          collectionDisplayName: 'Posts',
          fields: collectionRefs.posts.fields,
          values: { id: '11', title: 'Post B' },
        },
      ]);
    });

    it('should fallback to relationName when no CollectionRef exists', async () => {
      mockRelation.list.mockResolvedValue([{ id: '1' }]);

      const result = await port.getRelatedData('users', '42', 'unknownRelation');

      expect(result[0].collectionName).toBe('unknownRelation');
      expect(result[0].fields).toEqual([]);
    });

    it('should return an empty array when no related data exists', async () => {
      mockRelation.list.mockResolvedValue([]);

      const result = await port.getRelatedData('users', '42', 'posts');

      expect(result).toEqual([]);
    });
  });

  describe('getActions', () => {
    it('should return action names from actionEndpoints', async () => {
      const result = await port.getActions('users');

      expect(result).toEqual(['sendEmail', 'archive']);
    });

    it('should return an empty array for an unknown collection', async () => {
      const result = await port.getActions('unknown');

      expect(result).toEqual([]);
    });
  });

  describe('executeAction', () => {
    it('should call action then execute with the correct recordIds', async () => {
      mockAction.execute.mockResolvedValue({ success: 'Email sent' });

      const result = await port.executeAction('users', 'sendEmail', ['1', '2']);

      expect(client.collection).toHaveBeenCalledWith('users');
      expect(mockCollection.action).toHaveBeenCalledWith('sendEmail', { recordIds: ['1', '2'] });
      expect(mockAction.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: 'Email sent' });
    });

    it('should propagate errors from action execution', async () => {
      mockAction.execute.mockRejectedValue(new Error('Action failed'));

      await expect(port.executeAction('users', 'sendEmail', ['1'])).rejects.toThrow(
        'Action failed',
      );
    });
  });
});
