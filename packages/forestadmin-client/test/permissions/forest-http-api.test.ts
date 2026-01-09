import ForestHttpApi from '../../src/permissions/forest-http-api';
import ServerUtils from '../../src/utils/server';
import * as factories from '../__factories__';

jest.mock('../../src/utils/server', () => ({
  query: jest.fn(),
  queryWithBearerToken: jest.fn(),
}));

describe('ForestHttpApi', () => {
  const options = factories.forestAdminClientOptions.build();

  test('getEnvironmentPermissions should call the right endpoint', async () => {
    await new ForestHttpApi().getEnvironmentPermissions(options);

    expect(ServerUtils.query).toHaveBeenCalledWith(
      options,
      'get',
      '/liana/v4/permissions/environment',
    );
  });

  test('getUsers should call the right endpoint', async () => {
    await new ForestHttpApi().getUsers(options);

    expect(ServerUtils.query).toHaveBeenCalledWith(options, 'get', '/liana/v4/permissions/users');
  });

  test('getRenderingPermissions should call the right endpoint', async () => {
    await new ForestHttpApi().getRenderingPermissions(42, options);

    expect(ServerUtils.query).toHaveBeenCalledWith(
      options,
      'get',
      '/liana/v4/permissions/renderings/42',
    );
  });

  describe('getModelCustomizations', () => {
    it('should call the right endpoint', async () => {
      await new ForestHttpApi().getModelCustomizations(options);

      expect(ServerUtils.query).toHaveBeenCalledWith(options, 'get', '/liana/model-customizations');
    });
  });

  describe('getMcpServerConfigs', () => {
    it('should call the right endpoint', async () => {
      await new ForestHttpApi().getMcpServerConfigs(options);

      expect(ServerUtils.query).toHaveBeenCalledWith(
        options,
        'get',
        '/liana/mcp-server-configs-with-details',
      );
    });
  });

  describe('getIpWhitelistRules', () => {
    it('should call the right endpoint', async () => {
      const mockResponse = {
        data: { attributes: { use_ip_whitelist: true, rules: [] } },
      };
      (ServerUtils.query as jest.Mock).mockResolvedValue(mockResponse);

      const result = await new ForestHttpApi().getIpWhitelistRules(options);

      expect(ServerUtils.query).toHaveBeenCalledWith(
        options,
        'get',
        '/liana/v1/ip-whitelist-rules',
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getSchema', () => {
    it('should call the right endpoint and deserialize response', async () => {
      const mockResponse = {
        data: [{ id: 'users', type: 'collections', attributes: { name: 'users' } }],
        included: [],
      };
      (ServerUtils.query as jest.Mock).mockResolvedValue(mockResponse);

      const result = await new ForestHttpApi().getSchema(options);

      expect(ServerUtils.query).toHaveBeenCalledWith(options, 'get', '/liana/forest-schema');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('users');
    });
  });

  describe('postSchema', () => {
    it('should call the right endpoint with schema', async () => {
      const schema = { data: [], meta: { schemaFileHash: 'abc123' } };

      await new ForestHttpApi().postSchema(options, schema);

      expect(ServerUtils.query).toHaveBeenCalledWith(
        options,
        'post',
        '/forest/apimaps',
        {},
        schema,
      );
    });
  });

  describe('checkSchemaHash', () => {
    it('should call the right endpoint with hash', async () => {
      (ServerUtils.query as jest.Mock).mockResolvedValue({ sendSchema: true });

      const result = await new ForestHttpApi().checkSchemaHash(options, 'abc123');

      expect(ServerUtils.query).toHaveBeenCalledWith(
        options,
        'post',
        '/forest/apimaps/hashcheck',
        {},
        { schemaFileHash: 'abc123' },
      );
      expect(result).toEqual({ sendSchema: true });
    });
  });

  describe('createActivityLog', () => {
    it('should call the right endpoint with body', async () => {
      const mockActivityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue({ data: mockActivityLog });

      const body = { data: { id: 1, type: 'activity-logs-requests' } };
      const result = await new ForestHttpApi().createActivityLog(options, 'bearer-token', body);

      expect(ServerUtils.queryWithBearerToken).toHaveBeenCalledWith({
        forestServerUrl: options.forestServerUrl,
        method: 'post',
        path: '/api/activity-logs-requests',
        bearerToken: 'bearer-token',
        body,
      });
      expect(result).toEqual(mockActivityLog);
    });
  });

  describe('updateActivityLogStatus', () => {
    it('should call the right endpoint with status', async () => {
      const body = { status: 'completed' };

      await new ForestHttpApi().updateActivityLogStatus(
        options,
        'bearer-token',
        'idx-456',
        'log-123',
        body,
      );

      expect(ServerUtils.queryWithBearerToken).toHaveBeenCalledWith({
        forestServerUrl: options.forestServerUrl,
        method: 'patch',
        path: '/api/activity-logs-requests/idx-456/log-123/status',
        bearerToken: 'bearer-token',
        body,
      });
    });
  });
});
