import type { ActionEndpointsByCollection, RemoteAgentClient } from '@forestadmin/agent-client';

import AgentClientAgentPort from '../../src/adapters/agent-client-agent-port';
import { RecordNotFoundError } from '../../src/errors';

function createMockClient() {
  const mockAction = { execute: jest.fn() };
  const mockRelation = { list: jest.fn() };
  const mockCollection = {
    list: jest.fn(),
    update: jest.fn(),
    capabilities: jest.fn(),
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

    port = new AgentClientAgentPort({ client, actionEndpoints });
  });

  describe('getRecord', () => {
    it('should return a RecordData when the record exists', async () => {
      mockCollection.list.mockResolvedValue([{ id: '42', name: 'Alice' }]);
      mockCollection.capabilities.mockResolvedValue({
        fields: [
          { name: 'id', type: 'Number', operators: ['equal'] },
          { name: 'name', type: 'String', operators: ['equal', 'contains'] },
        ],
      });

      const result = await port.getRecord('users', '42');

      expect(client.collection).toHaveBeenCalledWith('users');
      expect(mockCollection.list).toHaveBeenCalledWith({
        filters: { field: 'id', operator: 'Equal', value: '42' },
        pagination: { size: 1, number: 1 },
      });
      expect(result).toEqual({
        recordId: '42',
        collectionName: 'users',
        collectionDisplayName: 'users',
        fields: [
          {
            fieldName: 'id',
            displayName: 'id',
            type: 'Number',
            isRelationship: false,
            referencedCollectionName: undefined,
          },
          {
            fieldName: 'name',
            displayName: 'name',
            type: 'String',
            isRelationship: false,
            referencedCollectionName: undefined,
          },
        ],
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

    it('should cache capabilities between calls on the same collection', async () => {
      mockCollection.list.mockResolvedValue([{ id: '1' }]);
      mockCollection.capabilities.mockResolvedValue({ fields: [] });

      await port.getRecord('users', '1');
      await port.getRecord('users', '2');

      expect(mockCollection.capabilities).toHaveBeenCalledTimes(1);
    });

    it('should evict cache and retry when capabilities rejects', async () => {
      mockCollection.list.mockResolvedValue([{ id: '1' }]);
      mockCollection.capabilities
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ fields: [{ name: 'id', type: 'Number', operators: [] }] });

      await expect(port.getRecord('users', '1')).rejects.toThrow('Network error');

      const result = await port.getRecord('users', '1');

      expect(mockCollection.capabilities).toHaveBeenCalledTimes(2);
      expect(result.fields).toEqual([expect.objectContaining({ fieldName: 'id', type: 'Number' })]);
    });

    it.each(['ManyToOne', 'OneToOne', 'OneToMany', 'ManyToMany'])(
      'should map %s fields as relationships',
      async type => {
        mockCollection.list.mockResolvedValue([{ id: '1' }]);
        mockCollection.capabilities.mockResolvedValue({
          fields: [{ name: 'rel', type, operators: [] }],
        });

        const result = await port.getRecord('users', '1');

        expect(result.fields[0]).toEqual(
          expect.objectContaining({ isRelationship: true, fieldName: 'rel' }),
        );
      },
    );
  });

  describe('updateRecord', () => {
    it('should return a RecordData after update', async () => {
      mockCollection.update.mockResolvedValue({ id: '42', name: 'Bob' });
      mockCollection.capabilities.mockResolvedValue({
        fields: [{ name: 'name', type: 'String', operators: [] }],
      });

      const result = await port.updateRecord('users', '42', { name: 'Bob' });

      expect(mockCollection.update).toHaveBeenCalledWith('42', { name: 'Bob' });
      expect(result).toEqual({
        recordId: '42',
        collectionName: 'users',
        collectionDisplayName: 'users',
        fields: [
          {
            fieldName: 'name',
            displayName: 'name',
            type: 'String',
            isRelationship: false,
            referencedCollectionName: undefined,
          },
        ],
        values: { id: '42', name: 'Bob' },
      });
    });
  });

  describe('getRelatedData', () => {
    it('should return a RecordData array', async () => {
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
          collectionDisplayName: 'posts',
          fields: [],
          values: { id: '10', title: 'Post A' },
        },
        {
          recordId: '11',
          collectionName: 'posts',
          collectionDisplayName: 'posts',
          fields: [],
          values: { id: '11', title: 'Post B' },
        },
      ]);
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
