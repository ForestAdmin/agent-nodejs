import type { ZendeskClient } from '../../src/client';
import type { Caller, DataSource } from '@forestadmin/datasource-toolkit';

import {
  ConditionTreeLeaf,
  Filter,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';

import OrganizationCollection from '../../src/collections/organization-collection';

const CALLER = { timezone: 'UTC' } as unknown as Caller;

function makeClient(): jest.Mocked<ZendeskClient> {
  return {
    search: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findOrganization: jest.fn().mockResolvedValue(null),
    createOrganization: jest.fn().mockResolvedValue({}),
    updateOrganization: jest.fn().mockResolvedValue({}),
    deleteOrganization: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ZendeskClient>;
}

function makeDatasource(): DataSource {
  return { customFieldMapping: new Map() } as unknown as DataSource;
}

describe('OrganizationCollection', () => {
  describe('schema', () => {
    it('declares OneToMany relations to users and tickets', () => {
      const collection = new OrganizationCollection(makeDatasource(), makeClient(), []);

      expect(collection.schema.fields.users).toMatchObject({
        type: 'OneToMany',
        foreignCollection: 'zendesk_user',
        originKey: 'organization_id',
      });
      expect(collection.schema.fields.tickets).toMatchObject({
        type: 'OneToMany',
        foreignCollection: 'zendesk_ticket',
        originKey: 'organization_id',
      });
    });
  });

  describe('list', () => {
    it('serializes organization fields and exposes custom fields by key', async () => {
      const client = makeClient();
      client.findOrganization.mockResolvedValue({
        id: 5,
        name: 'Acme',
        organization_fields: { industry: 'software' },
      });
      const collection = new OrganizationCollection(makeDatasource(), client, []);

      const records = await collection.list(
        CALLER,
        new PaginatedFilter({ conditionTree: new ConditionTreeLeaf('id', 'Equal', 5) }),
        new Projection('id', 'name', 'industry'),
      );

      expect(records).toEqual([{ id: 5, name: 'Acme', industry: 'software' }]);
    });
  });

  describe('update', () => {
    it('routes custom fields under organization_fields by key', async () => {
      const client = makeClient();
      const collection = new OrganizationCollection(makeDatasource(), client, [
        {
          columnName: 'industry',
          zendeskId: 1,
          zendeskKey: 'industry',
          schema: {
            type: 'Column',
            columnType: 'String',
            filterOperators: new Set(),
          },
        },
      ]);

      await collection.update(
        CALLER,
        new Filter({ conditionTree: new ConditionTreeLeaf('id', 'Equal', 7) }),
        { name: 'New name', industry: 'fintech' },
      );

      expect(client.updateOrganization).toHaveBeenCalledWith(7, {
        name: 'New name',
        organization_fields: { industry: 'fintech' },
      });
    });
  });
});
