import type { RawCustomFieldDefinition, ZendeskClient } from '../../src/client';

import { CustomFieldsIntrospector } from '../../src/schema/custom-fields-introspector';

function mockClient(overrides: Partial<ZendeskClient> = {}): ZendeskClient {
  return {
    fetchTicketFields: jest.fn().mockResolvedValue([]),
    fetchUserFields: jest.fn().mockResolvedValue([]),
    fetchOrganizationFields: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ZendeskClient;
}

function ticketField(overrides: Partial<RawCustomFieldDefinition> = {}): RawCustomFieldDefinition {
  return {
    id: 100,
    type: 'text',
    active: true,
    removable: true,
    ...overrides,
  };
}

describe('CustomFieldsIntrospector', () => {
  describe('ticketCustomFields', () => {
    it('keeps only active and removable fields', async () => {
      const client = mockClient({
        fetchTicketFields: jest
          .fn()
          .mockResolvedValue([
            ticketField({ id: 1, type: 'text' }),
            ticketField({ id: 2, type: 'text', active: false }),
            ticketField({ id: 3, type: 'text', removable: false }),
            ticketField({ id: 4, type: 'text', active: true, removable: true }),
          ]),
      });
      const introspector = new CustomFieldsIntrospector(client);

      const fields = await introspector.ticketCustomFields();

      expect(fields.map(f => f.zendeskId)).toEqual([1, 4]);
    });

    it('names ticket columns as custom_<id>', async () => {
      const client = mockClient({
        fetchTicketFields: jest.fn().mockResolvedValue([ticketField({ id: 42, type: 'text' })]),
      });

      const [entry] = await new CustomFieldsIntrospector(client).ticketCustomFields();

      expect(entry.columnName).toBe('custom_42');
    });

    it('maps text/textarea/regexp/partialcreditcard to String column', async () => {
      const client = mockClient({
        fetchTicketFields: jest
          .fn()
          .mockResolvedValue([
            ticketField({ id: 1, type: 'text' }),
            ticketField({ id: 2, type: 'textarea' }),
            ticketField({ id: 3, type: 'regexp' }),
            ticketField({ id: 4, type: 'partialcreditcard' }),
          ]),
      });

      const fields = await new CustomFieldsIntrospector(client).ticketCustomFields();

      expect(fields.map(f => f.schema.columnType)).toEqual([
        'String',
        'String',
        'String',
        'String',
      ]);
    });

    it('maps integer/decimal/lookup to Number column with number operators', async () => {
      const client = mockClient({
        fetchTicketFields: jest
          .fn()
          .mockResolvedValue([
            ticketField({ id: 1, type: 'integer' }),
            ticketField({ id: 2, type: 'decimal' }),
            ticketField({ id: 3, type: 'lookup' }),
          ]),
      });

      const fields = await new CustomFieldsIntrospector(client).ticketCustomFields();

      expect(fields.map(f => f.schema.columnType)).toEqual(['Number', 'Number', 'Number']);
      expect([...(fields[0].schema.filterOperators ?? [])]).toContain('GreaterThan');
    });

    it('maps date to Dateonly column', async () => {
      const client = mockClient({
        fetchTicketFields: jest.fn().mockResolvedValue([ticketField({ id: 1, type: 'date' })]),
      });

      const [entry] = await new CustomFieldsIntrospector(client).ticketCustomFields();

      expect(entry.schema.columnType).toBe('Dateonly');
    });

    it('maps checkbox to Boolean column with Equal/NotEqual', async () => {
      const client = mockClient({
        fetchTicketFields: jest.fn().mockResolvedValue([ticketField({ id: 1, type: 'checkbox' })]),
      });

      const [entry] = await new CustomFieldsIntrospector(client).ticketCustomFields();

      expect(entry.schema.columnType).toBe('Boolean');
      expect([...(entry.schema.filterOperators ?? [])].sort()).toEqual(['Equal', 'NotEqual']);
    });

    it('maps multiselect to Json column with no filter operators', async () => {
      const client = mockClient({
        fetchTicketFields: jest
          .fn()
          .mockResolvedValue([ticketField({ id: 1, type: 'multiselect' })]),
      });

      const [entry] = await new CustomFieldsIntrospector(client).ticketCustomFields();

      expect(entry.schema.columnType).toBe('Json');
      expect(entry.schema.filterOperators?.size ?? 0).toBe(0);
    });

    it('maps dropdown with options to Enum column with declared enum values', async () => {
      const client = mockClient({
        fetchTicketFields: jest.fn().mockResolvedValue([
          ticketField({
            id: 1,
            type: 'dropdown',
            custom_field_options: [{ value: 'red' }, { value: 'blue' }],
          }),
        ]),
      });

      const [entry] = await new CustomFieldsIntrospector(client).ticketCustomFields();

      expect(entry.schema.columnType).toBe('Enum');
      expect(entry.schema.enumValues).toEqual(['red', 'blue']);
    });

    it('falls back to String column when dropdown has no options', async () => {
      const client = mockClient({
        fetchTicketFields: jest
          .fn()
          .mockResolvedValue([ticketField({ id: 1, type: 'dropdown', custom_field_options: [] })]),
      });

      const [entry] = await new CustomFieldsIntrospector(client).ticketCustomFields();

      expect(entry.schema.columnType).toBe('String');
    });

    it('skips unsupported field types', async () => {
      const client = mockClient({
        fetchTicketFields: jest
          .fn()
          .mockResolvedValue([
            ticketField({ id: 1, type: 'unsupported-type' }),
            ticketField({ id: 2, type: 'text' }),
          ]),
      });

      const fields = await new CustomFieldsIntrospector(client).ticketCustomFields();

      expect(fields.map(f => f.zendeskId)).toEqual([2]);
    });
  });

  describe('userCustomFields', () => {
    it('keeps only active fields (no removable filter)', async () => {
      const client = mockClient({
        fetchUserFields: jest.fn().mockResolvedValue([
          { id: 1, key: 'my_field', type: 'text', active: true, removable: false },
          { id: 2, key: 'inactive', type: 'text', active: false, removable: false },
        ]),
      });

      const fields = await new CustomFieldsIntrospector(client).userCustomFields();

      expect(fields.map(f => f.zendeskId)).toEqual([1]);
    });

    it('uses the field key as Forest column name', async () => {
      const client = mockClient({
        fetchUserFields: jest
          .fn()
          .mockResolvedValue([{ id: 1, key: 'preferred_language', type: 'text', active: true }]),
      });

      const [entry] = await new CustomFieldsIntrospector(client).userCustomFields();

      expect(entry.columnName).toBe('preferred_language');
      expect(entry.zendeskKey).toBe('preferred_language');
    });

    it('falls back to custom_<id> when key is missing', async () => {
      const client = mockClient({
        fetchUserFields: jest.fn().mockResolvedValue([{ id: 7, type: 'text', active: true }]),
      });

      const [entry] = await new CustomFieldsIntrospector(client).userCustomFields();

      expect(entry.columnName).toBe('custom_7');
    });
  });

  describe('organizationCustomFields', () => {
    it('returns active organization custom fields with their key', async () => {
      const client = mockClient({
        fetchOrganizationFields: jest
          .fn()
          .mockResolvedValue([{ id: 1, key: 'industry', type: 'text', active: true }]),
      });

      const fields = await new CustomFieldsIntrospector(client).organizationCustomFields();

      expect(fields).toHaveLength(1);
      expect(fields[0].columnName).toBe('industry');
    });
  });
});
