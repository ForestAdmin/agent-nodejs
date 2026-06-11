import type { ZendeskClient } from '../../src/client';
import type { Caller, DataSource } from '@forestadmin/datasource-toolkit';

import {
  Aggregation,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Filter,
  Page,
  PaginatedFilter,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';

import TicketCollection from '../../src/collections/ticket-collection';
import { UnsupportedOperatorError, ZendeskApiError } from '../../src/errors';

const CALLER = { timezone: 'UTC' } as unknown as Caller;

function makeClient(): jest.Mocked<ZendeskClient> {
  return {
    search: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findTicket: jest.fn().mockResolvedValue(null),
    findUser: jest.fn().mockResolvedValue(null),
    findOrganization: jest.fn().mockResolvedValue(null),
    fetchTicketsByIds: jest.fn().mockResolvedValue(new Map()),
    fetchUsersByIds: jest.fn().mockResolvedValue(new Map()),
    fetchOrganizationsByIds: jest.fn().mockResolvedValue(new Map()),
    fetchUserEmails: jest.fn().mockResolvedValue(new Map()),
    fetchTicketComments: jest.fn().mockResolvedValue([]),
    fetchTicketFields: jest.fn().mockResolvedValue([]),
    fetchUserFields: jest.fn().mockResolvedValue([]),
    fetchOrganizationFields: jest.fn().mockResolvedValue([]),
    createTicket: jest.fn().mockResolvedValue({}),
    updateTicket: jest.fn().mockResolvedValue({}),
    deleteTicket: jest.fn().mockResolvedValue(undefined),
    createUser: jest.fn().mockResolvedValue({}),
    updateUser: jest.fn().mockResolvedValue({}),
    deleteUser: jest.fn().mockResolvedValue(undefined),
    createOrganization: jest.fn().mockResolvedValue({}),
    updateOrganization: jest.fn().mockResolvedValue({}),
    deleteOrganization: jest.fn().mockResolvedValue(undefined),
    bestEffort: jest.fn(async (_op, _default, fn) => fn()),
    baseUrl: 'https://acme.zendesk.com/api/v2',
  } as unknown as jest.Mocked<ZendeskClient>;
}

function makeDatasource(): DataSource {
  return { customFieldMapping: new Map() } as unknown as DataSource;
}

function buildCollection(client: ZendeskClient): TicketCollection {
  return new TicketCollection(makeDatasource(), client, []);
}

describe('TicketCollection', () => {
  describe('schema', () => {
    it('declares id as primary key with number filter operators', () => {
      const collection = buildCollection(makeClient());
      const idField = collection.schema.fields.id;

      expect(idField).toMatchObject({ type: 'Column', columnType: 'Number', isPrimaryKey: true });
    });

    it('declares status as Enum with the ticket statuses', () => {
      const collection = buildCollection(makeClient());
      const { status } = collection.schema.fields;

      expect(status).toMatchObject({
        type: 'Column',
        columnType: 'Enum',
        enumValues: ['new', 'open', 'pending', 'hold', 'solved', 'closed'],
      });
    });

    it('declares relations to user and organization collections', () => {
      const collection = buildCollection(makeClient());

      expect(collection.schema.fields.requester).toMatchObject({
        type: 'ManyToOne',
        foreignCollection: 'zendesk_user',
        foreignKey: 'requester_id',
      });
      expect(collection.schema.fields.organization).toMatchObject({
        type: 'ManyToOne',
        foreignCollection: 'zendesk_organization',
      });
    });

    it('registers a custom field schema and exposes it under the custom_<id> column', () => {
      const datasource = makeDatasource();
      const collection = new TicketCollection(datasource, makeClient(), [
        {
          columnName: 'custom_123',
          zendeskId: 123,
          schema: {
            type: 'Column',
            columnType: 'String',
            filterOperators: new Set(['Equal']),
            isReadOnly: false,
            isSortable: false,
          },
        },
      ]);

      expect(collection.schema.fields.custom_123).toBeDefined();
    });

    it('skips a custom field whose column name collides with a native field', () => {
      const logger = jest.fn();
      const collection = new TicketCollection(
        makeDatasource(),
        makeClient(),
        [
          {
            columnName: 'subject',
            zendeskId: 999,
            schema: {
              type: 'Column',
              columnType: 'String',
              filterOperators: new Set(),
            },
          },
        ],
        logger,
      );

      // The native `subject` column remains String — but the test ensures the warn fires.
      expect(collection.schema.fields.subject.type).toBe('Column');
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        expect.stringContaining("Custom field 'subject' collides"),
      );
    });
  });

  describe('list', () => {
    it('short-circuits to findTicket when the filter is an exact id Equal lookup', async () => {
      const client = makeClient();
      client.findTicket.mockResolvedValue({ id: 5, subject: 'hello', type: 'question' });
      const collection = buildCollection(client);

      const records = await collection.list(
        CALLER,
        new PaginatedFilter({ conditionTree: new ConditionTreeLeaf('id', 'Equal', 5) }),
        new Projection('id', 'subject', 'ticket_type'),
      );

      expect(client.findTicket).toHaveBeenCalledWith(5);
      expect(client.search).not.toHaveBeenCalled();
      expect(records).toEqual([{ id: 5, subject: 'hello', ticket_type: 'question' }]);
    });

    it('applies sort and pagination in memory on an id-lookup list', async () => {
      const client = makeClient();
      client.findTicket.mockImplementation(async id => ({ id, subject: `s${id}` }));
      const collection = buildCollection(client);

      const records = await collection.list(
        CALLER,
        new PaginatedFilter({
          conditionTree: new ConditionTreeLeaf('id', 'In', [1, 2, 3]),
          page: new Page(1, 1),
          sort: new Sort({ field: 'id', ascending: false }),
        }),
        new Projection('id'),
      );

      expect(client.search).not.toHaveBeenCalled();
      expect(records).toEqual([{ id: 2 }]);
    });

    it('uses search and translates the condition tree when no id lookup', async () => {
      const client = makeClient();
      client.search.mockResolvedValue([
        { id: 7, subject: 'one', status: 'open', type: 'incident' },
      ]);
      const collection = buildCollection(client);

      await collection.list(
        CALLER,
        new PaginatedFilter({
          conditionTree: new ConditionTreeLeaf('status', 'Equal', 'open'),
          page: new Page(0, 25),
          sort: new Sort({ field: 'created_at', ascending: false }),
        }),
        new Projection('id', 'subject'),
      );

      expect(client.search).toHaveBeenCalledWith('ticket', {
        query: 'status:open',
        page: 1,
        perPage: 25,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });
    });

    it('fetches user emails when the projection includes requester_email', async () => {
      const client = makeClient();
      client.search.mockResolvedValue([{ id: 1, requester_id: 99, subject: 's' }]);
      client.fetchUserEmails.mockResolvedValue(new Map([[99, 'foo@example.com']]));
      const collection = buildCollection(client);

      const records = await collection.list(
        CALLER,
        new PaginatedFilter({}),
        new Projection('id', 'requester_email'),
      );

      expect(client.fetchUserEmails).toHaveBeenCalledWith([99]);
      expect(records).toEqual([{ id: 1, requester_email: 'foo@example.com' }]);
    });

    it('embeds the requester relation when projection contains requester:*', async () => {
      const client = makeClient();
      client.search.mockResolvedValue([{ id: 1, requester_id: 99, subject: 's' }]);
      client.fetchUsersByIds.mockResolvedValue(
        new Map([[99, { id: 99, email: 'foo@x.com', name: 'Foo' }]]),
      );
      const collection = buildCollection(client);

      const records = await collection.list(
        CALLER,
        new PaginatedFilter({}),
        new Projection('id', 'requester:id', 'requester:email'),
      );

      expect(client.fetchUsersByIds).toHaveBeenCalledWith([99]);
      expect(records[0].requester).toEqual({ id: 99, email: 'foo@x.com' });
    });

    it('embeds comments when projection includes comments', async () => {
      const client = makeClient();
      client.search.mockResolvedValue([{ id: 1, subject: 's' }]);
      client.fetchTicketComments.mockResolvedValue([
        {
          id: 10,
          body: 'b',
          html_body: '<p>b</p>',
          public: true,
          author_id: 99,
          created_at: 'now',
        },
      ]);
      client.fetchUsersByIds.mockResolvedValue(
        new Map([[99, { id: 99, email: 'foo@x.com', name: 'Foo' }]]),
      );
      const collection = buildCollection(client);

      const records = await collection.list(
        CALLER,
        new PaginatedFilter({}),
        new Projection('id', 'comments'),
      );

      expect(client.fetchTicketComments).toHaveBeenCalledWith(1);
      expect((records[0] as { comments: Array<Record<string, unknown>> }).comments[0]).toEqual({
        id: 10,
        body: 'b',
        html_body: '<p>b</p>',
        public: true,
        author_email: 'foo@x.com',
        author_name: 'Foo',
        created_at: 'now',
      });
    });

    it('throws when skip+limit exceeds Zendesk Search 1000-result cap', async () => {
      const client = makeClient();
      const collection = buildCollection(client);

      await expect(
        collection.list(
          CALLER,
          new PaginatedFilter({ page: new Page(950, 100) }),
          new Projection('id'),
        ),
      ).rejects.toThrow(UnsupportedOperatorError);
    });
  });

  describe('create', () => {
    it('strips read-only fields and maps ticket_type to type', async () => {
      const client = makeClient();
      client.createTicket.mockResolvedValue({ id: 7, subject: 'hi', type: 'question' });
      const collection = buildCollection(client);

      await collection.create(CALLER, [
        {
          id: 999,
          subject: 'hi',
          ticket_type: 'question',
          description: 'body',
          requester_email: 'ignored@example.com',
          url: 'ignored-url',
        },
      ]);

      expect(client.createTicket).toHaveBeenCalledWith({
        subject: 'hi',
        type: 'question',
        description: 'body',
        comment: { body: 'body' },
      });
    });

    it('puts custom fields under the custom_fields array', async () => {
      const client = makeClient();
      client.createTicket.mockResolvedValue({ id: 1 });
      const collection = new TicketCollection(makeDatasource(), client, [
        {
          columnName: 'custom_123',
          zendeskId: 123,
          schema: {
            type: 'Column',
            columnType: 'String',
            filterOperators: new Set(),
          },
        },
      ]);

      await collection.create(CALLER, [{ subject: 'hi', custom_123: 'red' }]);

      expect(client.createTicket).toHaveBeenCalledWith({
        subject: 'hi',
        custom_fields: [{ id: 123, value: 'red' }],
      });
    });
  });

  describe('update', () => {
    it('PUTs the patch to each id from the filter', async () => {
      const client = makeClient();
      const collection = buildCollection(client);

      await collection.update(
        CALLER,
        new Filter({ conditionTree: new ConditionTreeLeaf('id', 'In', [1, 2]) }),
        { status: 'solved' },
      );

      expect(client.updateTicket).toHaveBeenCalledWith(1, { status: 'solved' });
      expect(client.updateTicket).toHaveBeenCalledWith(2, { status: 'solved' });
      expect(client.updateTicket).toHaveBeenCalledTimes(2);
    });

    it('ignores description on update since Zendesk cannot edit it after creation', async () => {
      const client = makeClient();
      const collection = buildCollection(client);

      await collection.update(
        CALLER,
        new Filter({ conditionTree: new ConditionTreeLeaf('id', 'Equal', 7) }),
        { status: 'solved', description: 'new body' },
      );

      expect(client.updateTicket).toHaveBeenCalledWith(7, { status: 'solved' });
    });
  });

  describe('delete', () => {
    it('issues a delete for each id in the filter', async () => {
      const client = makeClient();
      const collection = buildCollection(client);

      await collection.delete(
        CALLER,
        new Filter({ conditionTree: new ConditionTreeLeaf('id', 'Equal', 42) }),
      );

      expect(client.deleteTicket).toHaveBeenCalledWith(42);
    });

    it('does not delete an id that fails a sibling (scope) condition', async () => {
      const client = makeClient();
      client.findTicket.mockResolvedValue({ id: 5, status: 'open' });
      const collection = buildCollection(client);

      await collection.delete(
        CALLER,
        new Filter({
          conditionTree: new ConditionTreeBranch('And', [
            new ConditionTreeLeaf('id', 'Equal', 5),
            new ConditionTreeLeaf('status', 'Equal', 'closed'),
          ]),
        }),
      );

      expect(client.findTicket).toHaveBeenCalledWith(5);
      expect(client.deleteTicket).not.toHaveBeenCalled();
    });

    it('paginates through every matching page when the filter is not an id-lookup', async () => {
      const client = makeClient();
      const firstPage = Array.from({ length: 100 }, (_unused, index) => ({ id: index + 1 }));
      const secondPage = Array.from({ length: 50 }, (_unused, index) => ({ id: index + 101 }));
      client.search.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);
      const collection = buildCollection(client);

      await collection.delete(
        CALLER,
        new Filter({ conditionTree: new ConditionTreeLeaf('status', 'Equal', 'open') }),
      );

      expect(client.search).toHaveBeenCalledTimes(2);
      expect(client.deleteTicket).toHaveBeenCalledTimes(150);
    });
  });

  describe('aggregate', () => {
    it('counts only the ids that actually exist on an id-lookup', async () => {
      const client = makeClient();
      client.findTicket.mockImplementation(async id => (id === 3 ? null : { id }));
      const collection = buildCollection(client);

      const result = await collection.aggregate(
        CALLER,
        new Filter({ conditionTree: new ConditionTreeLeaf('id', 'In', [1, 2, 3]) }),
        new Aggregation({ operation: 'Count' }),
      );

      expect(client.count).not.toHaveBeenCalled();
      expect(result).toEqual([{ value: 2, group: {} }]);
    });

    it('calls client.count with the translated query for non-id filters', async () => {
      const client = makeClient();
      client.count.mockResolvedValue(17);
      const collection = buildCollection(client);

      const result = await collection.aggregate(
        CALLER,
        new Filter({
          conditionTree: new ConditionTreeBranch('And', [
            new ConditionTreeLeaf('status', 'Equal', 'open'),
          ]),
        }),
        new Aggregation({ operation: 'Count' }),
      );

      expect(client.count).toHaveBeenCalledWith('ticket', 'status:open');
      expect(result).toEqual([{ value: 17, group: {} }]);
    });

    it('throws on grouped or non-Count aggregations', async () => {
      const client = makeClient();
      const collection = buildCollection(client);

      await expect(
        collection.aggregate(
          CALLER,
          new Filter({}),
          new Aggregation({ operation: 'Count', groups: [{ field: 'status' }] }),
        ),
      ).rejects.toThrow(UnsupportedOperatorError);
    });
  });

  describe('error propagation', () => {
    it('surfaces ZendeskApiError raised during list', async () => {
      const client = makeClient();
      client.search.mockRejectedValue(new ZendeskApiError('boom', 500, {}));
      const collection = buildCollection(client);

      await expect(
        collection.list(CALLER, new PaginatedFilter({}), new Projection('id')),
      ).rejects.toThrow(ZendeskApiError);
    });
  });
});
