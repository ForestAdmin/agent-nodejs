import type { ZendeskClient } from '../src/client';

import ZendeskDataSource, { COLLECTION_NAMES } from '../src/datasource';
import { createZendeskDataSource } from '../src/factory';

function makeClient(overrides: Partial<ZendeskClient> = {}): ZendeskClient {
  return {
    fetchTicketFields: jest.fn().mockResolvedValue([]),
    fetchUserFields: jest.fn().mockResolvedValue([]),
    fetchOrganizationFields: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ZendeskClient;
}

describe('ZendeskDataSource.create', () => {
  it('registers the three collections under their canonical names', async () => {
    const ds = await ZendeskDataSource.create(makeClient());

    expect(ds.collections.map(c => c.name).sort()).toEqual([
      COLLECTION_NAMES.organization,
      COLLECTION_NAMES.ticket,
      COLLECTION_NAMES.user,
    ]);
  });

  it('builds a custom field mapping with ticket ids → custom_field_<id> and user/org keys', async () => {
    const client = makeClient({
      fetchTicketFields: jest
        .fn()
        .mockResolvedValue([{ id: 123, type: 'text', active: true, removable: true }]),
      fetchUserFields: jest
        .fn()
        .mockResolvedValue([{ id: 5, key: 'preferred_lang', type: 'text', active: true }]),
      fetchOrganizationFields: jest
        .fn()
        .mockResolvedValue([{ id: 7, key: 'industry', type: 'text', active: true }]),
    });

    const ds = await ZendeskDataSource.create(client);

    expect(ds.customFieldMapping.get('custom_123')).toBe('custom_field_123');
    expect(ds.customFieldMapping.get('preferred_lang')).toBe('preferred_lang');
    expect(ds.customFieldMapping.get('industry')).toBe('industry');
  });

  it('registers custom field columns on the Ticket collection', async () => {
    const client = makeClient({
      fetchTicketFields: jest
        .fn()
        .mockResolvedValue([{ id: 42, type: 'text', active: true, removable: true }]),
    });

    const ds = await ZendeskDataSource.create(client);
    const ticket = ds.getCollection(COLLECTION_NAMES.ticket);

    expect(ticket.schema.fields.custom_42).toBeDefined();
  });

  it('exposes the client used during introspection', async () => {
    const client = makeClient();
    const ds = await ZendeskDataSource.create(client);

    expect(ds.client).toBe(client);
  });
});

describe('createZendeskDataSource (factory)', () => {
  it('reuses a pre-built client when provided', async () => {
    const client = makeClient();
    const factory = createZendeskDataSource({ client });

    const ds = await factory(
      () => undefined,
      async () => undefined,
    );

    expect((ds as ZendeskDataSource).client).toBe(client);
  });
});
