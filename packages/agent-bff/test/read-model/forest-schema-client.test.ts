import { ForestHttpApi, SchemaService } from '@forestadmin/forestadmin-client';

import ForestSchemaClient from '../../src/read-model/forest-schema-client';

jest.mock('@forestadmin/forestadmin-client');

describe('ForestSchemaClient', () => {
  const getSchemaWithMeta = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (SchemaService as unknown as jest.Mock).mockImplementation(() => ({ getSchemaWithMeta }));
  });

  it('should construct a SchemaService with a ForestHttpApi and the server options', () => {
    const client = new ForestSchemaClient({
      forestServerUrl: 'https://api.test',
      envSecret: 'secret',
    });

    expect(client).toBeInstanceOf(ForestSchemaClient);
    expect(SchemaService).toHaveBeenCalledWith(expect.any(ForestHttpApi), {
      forestServerUrl: 'https://api.test',
      envSecret: 'secret',
    });
  });

  it('should delegate fetchSchema to SchemaService.getSchemaWithMeta, keeping the liana', async () => {
    const published = {
      collections: [{ name: 'users', fields: [], actions: [] }],
      meta: { liana: 'forest-rails', liana_version: '9.21.0' },
    };
    getSchemaWithMeta.mockResolvedValue(published);
    const client = new ForestSchemaClient({
      forestServerUrl: 'https://api.test',
      envSecret: 'secret',
    });

    const result = await client.fetchSchema();

    expect(getSchemaWithMeta).toHaveBeenCalledTimes(1);
    expect(result).toBe(published);
  });
});
