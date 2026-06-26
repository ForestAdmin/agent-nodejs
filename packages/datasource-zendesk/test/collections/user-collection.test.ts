import type { ZendeskClient } from '../../src/client';
import type { Caller, DataSource } from '@forestadmin/datasource-toolkit';

import {
  Aggregation,
  ConditionTreeLeaf,
  Filter,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';

import UserCollection from '../../src/collections/user-collection';

const CALLER = { timezone: 'UTC' } as unknown as Caller;

function makeClient(): jest.Mocked<ZendeskClient> {
  return {
    search: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findUser: jest.fn().mockResolvedValue(null),
    createUser: jest.fn().mockResolvedValue({}),
    updateUser: jest.fn().mockResolvedValue({}),
    deleteUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ZendeskClient>;
}

function makeDatasource(): DataSource {
  return { customFieldMapping: new Map() } as unknown as DataSource;
}

describe('UserCollection', () => {
  describe('schema', () => {
    it('declares role as Enum with end-user, agent and admin', () => {
      const collection = new UserCollection(makeDatasource(), makeClient(), []);

      expect(collection.schema.fields.role).toMatchObject({
        type: 'Column',
        columnType: 'Enum',
        enumValues: ['end-user', 'agent', 'admin'],
      });
    });

    it('declares a ManyToOne to zendesk_organization', () => {
      const collection = new UserCollection(makeDatasource(), makeClient(), []);

      expect(collection.schema.fields.organization).toMatchObject({
        type: 'ManyToOne',
        foreignCollection: 'zendesk_organization',
        foreignKey: 'organization_id',
      });
    });

    it('declares a OneToMany requested_tickets pointing back to tickets', () => {
      const collection = new UserCollection(makeDatasource(), makeClient(), []);

      expect(collection.schema.fields.requested_tickets).toMatchObject({
        type: 'OneToMany',
        foreignCollection: 'zendesk_ticket',
        originKey: 'requester_id',
      });
    });
  });

  describe('list', () => {
    it('short-circuits findUser on id lookup', async () => {
      const client = makeClient();
      client.findUser.mockResolvedValue({ id: 5, email: 'a@b.com', name: 'Alice' });
      const collection = new UserCollection(makeDatasource(), client, []);

      const records = await collection.list(
        CALLER,
        new PaginatedFilter({ conditionTree: new ConditionTreeLeaf('id', 'Equal', 5) }),
        new Projection('id', 'email', 'name'),
      );

      expect(client.findUser).toHaveBeenCalledWith(5);
      expect(client.search).not.toHaveBeenCalled();
      expect(records).toEqual([{ id: 5, email: 'a@b.com', name: 'Alice' }]);
    });

    it('searches with the translated query when no id lookup', async () => {
      const client = makeClient();
      client.search.mockResolvedValue([{ id: 1, email: 'foo@x.com', name: 'Foo' }]);
      const collection = new UserCollection(makeDatasource(), client, []);

      await collection.list(
        CALLER,
        new PaginatedFilter({ conditionTree: new ConditionTreeLeaf('role', 'Equal', 'admin') }),
        new Projection('id'),
      );

      expect(client.search).toHaveBeenCalledWith(
        'user',
        expect.objectContaining({ query: 'role:admin' }),
      );
    });
  });

  describe('create', () => {
    it('strips id/timestamps and routes custom fields into user_fields', async () => {
      const client = makeClient();
      client.createUser.mockResolvedValue({ id: 1, email: 'a@b.com' });
      const collection = new UserCollection(makeDatasource(), client, [
        {
          columnName: 'pref_lang',
          zendeskId: 11,
          zendeskKey: 'pref_lang',
          schema: {
            type: 'Column',
            columnType: 'String',
            filterOperators: new Set(),
          },
        },
      ]);

      await collection.create(CALLER, [
        { id: 99, email: 'a@b.com', name: 'Alice', pref_lang: 'fr', created_at: 'x' },
      ]);

      expect(client.createUser).toHaveBeenCalledWith({
        email: 'a@b.com',
        name: 'Alice',
        user_fields: { pref_lang: 'fr' },
      });
    });
  });

  describe('aggregate', () => {
    it('counts via the client when filter is not an id lookup', async () => {
      const client = makeClient();
      client.count.mockResolvedValue(11);
      const collection = new UserCollection(makeDatasource(), client, []);

      const result = await collection.aggregate(
        CALLER,
        new Filter({ conditionTree: new ConditionTreeLeaf('role', 'Equal', 'admin') }),
        new Aggregation({ operation: 'Count' }),
      );

      expect(client.count).toHaveBeenCalledWith('user', 'role:admin');
      expect(result).toEqual([{ value: 11, group: {} }]);
    });
  });
});
