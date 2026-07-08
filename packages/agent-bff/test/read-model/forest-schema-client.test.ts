import { ForestHttpApi, SchemaService } from '@forestadmin/forestadmin-client';

import ForestSchemaClient from '../../src/read-model/forest-schema-client';

jest.mock('@forestadmin/forestadmin-client');

describe('ForestSchemaClient', () => {
  const getSchema = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (SchemaService as unknown as jest.Mock).mockImplementation(() => ({ getSchema }));
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

  it('should delegate fetchSchema to SchemaService.getSchema', async () => {
    const collections = [{ name: 'users', fields: [], actions: [] }];
    getSchema.mockResolvedValue(collections);
    const client = new ForestSchemaClient({
      forestServerUrl: 'https://api.test',
      envSecret: 'secret',
    });

    const result = await client.fetchSchema();

    expect(getSchema).toHaveBeenCalledTimes(1);
    expect(result).toBe(collections);
  });
});
