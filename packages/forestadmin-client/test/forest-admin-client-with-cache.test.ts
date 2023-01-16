import * as factories from './__factories__';
import ForestAdminClient from '../src/forest-admin-client-with-cache';
import verifyAndExtractApproval from '../src/permissions/verify-approval';

jest.mock('../src/permissions/verify-approval', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const verifyAndExtractApprovalMock = verifyAndExtractApproval as jest.Mock;

describe('ForestAdminClientWithCache', () => {
  describe('getIpWhitelistConfiguration', () => {
    it('should delegate to the given service', async () => {
      const whiteListService = factories.ipWhiteList.build({
        getConfiguration: jest.fn().mockResolvedValueOnce({ isFeatureEnabled: true, ipRules: [] }),
      });

      const forestAdminClient = new ForestAdminClient(
        factories.forestAdminClientOptions.build(),
        factories.permission.build(),
        factories.renderingPermission.build(),
        factories.contextVariablesInstantiator.build(),
        factories.chartHandler.build(),
        whiteListService,
        factories.schema.build(),
        factories.auth.build(),
      );

      const config = await forestAdminClient.getIpWhitelistConfiguration();
      expect(config).toStrictEqual({ isFeatureEnabled: true, ipRules: [] });
      expect(whiteListService.getConfiguration).toHaveBeenCalledTimes(1);
    });
  });

  describe('postSchema', () => {
    it('should delegate to the given service', async () => {
      const schemaService = factories.schema.build({
        postSchema: jest.fn().mockResolvedValueOnce(true),
      });

      const forestAdminClient = new ForestAdminClient(
        factories.forestAdminClientOptions.build(),
        factories.permission.build(),
        factories.renderingPermission.build(),
        factories.contextVariablesInstantiator.build(),
        factories.chartHandler.build(),
        factories.ipWhiteList.build(),
        schemaService,
        factories.auth.build(),
      );

      const result = await forestAdminClient.postSchema([], 'forest-nodejs-agent', '1.0.0');
      expect(result).toBe(true);
      expect(schemaService.postSchema).toHaveBeenCalledTimes(1);
    });
  });

  describe('verifySignedActionParameters', () => {
    it('should return the signed parameter with the env secret', () => {
      const signedParameters = 'signedParameters';
      const options = factories.forestAdminClientOptions.build({ envSecret: 'secret' });
      const forestAdminClient = new ForestAdminClient(
        options,
        factories.permission.build(),
        factories.renderingPermission.build(),
        factories.contextVariablesInstantiator.build(),
        factories.chartHandler.build(),
        factories.ipWhiteList.build(),
        factories.schema.build(),
        factories.auth.build(),
      );

      verifyAndExtractApprovalMock.mockReturnValue(signedParameters);

      const result = forestAdminClient.verifySignedActionParameters(signedParameters);

      expect(result).toBe(signedParameters);
      expect(verifyAndExtractApprovalMock).toHaveBeenCalledWith(signedParameters, 'secret');
    });
  });

  describe('Auth', () => {
    it('getUserInfo should delegate to the given service', async () => {
      const authService = factories.auth.build({
        getUserInfo: jest.fn().mockResolvedValue({ id: 1 }),
      });

      const forestAdminClient = new ForestAdminClient(
        factories.forestAdminClientOptions.build(),
        factories.permission.build(),
        factories.renderingPermission.build(),
        factories.contextVariablesInstantiator.build(),
        factories.chartHandler.build(),
        factories.ipWhiteList.build(),
        factories.schema.build(),
        authService,
      );

      const result = await forestAdminClient.getUserInfo(1, 'token');
      expect(result).toStrictEqual({ id: 1 });
      expect(authService.getUserInfo).toHaveBeenCalledTimes(1);
      expect(authService.getUserInfo).toHaveBeenCalledWith(1, 'token');
    });

    it('getOpenIdClient should delegate to the given service', async () => {
      const authService = factories.auth.build({
        getOpenIdClient: jest.fn().mockResolvedValue({ sign: true }),
      });

      const forestAdminClient = new ForestAdminClient(
        factories.forestAdminClientOptions.build(),
        factories.permission.build(),
        factories.renderingPermission.build(),
        factories.contextVariablesInstantiator.build(),
        factories.chartHandler.build(),
        factories.ipWhiteList.build(),
        factories.schema.build(),
        authService,
      );

      const result = await forestAdminClient.getOpenIdClient();
      expect(result).toStrictEqual({ sign: true });
      expect(authService.getOpenIdClient).toHaveBeenCalledTimes(1);
      expect(authService.getOpenIdClient).toHaveBeenCalledWith();
    });
  });

  describe('markScopesAsUpdated', () => {
    it('should invalidate the cache of scopes', async () => {
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const forestAdminClient = new ForestAdminClient(
        factories.forestAdminClientOptions.build(),
        factories.permission.build(),
        renderingPermissionService,
        factories.contextVariablesInstantiator.build(),
        factories.chartHandler.build(),
        factories.ipWhiteList.build(),
        factories.schema.build(),
        factories.auth.build(),
      );

      await forestAdminClient.markScopesAsUpdated(42);

      expect(renderingPermissionService.invalidateCache).toHaveBeenCalledWith(42);
    });
  });

  describe('getScope', () => {
    it('should return the scope from the rendering service', async () => {
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const forestAdminClient = new ForestAdminClient(
        factories.forestAdminClientOptions.build(),
        factories.permission.build(),
        renderingPermissionService,
        factories.contextVariablesInstantiator.build(),
        factories.chartHandler.build(),
        factories.ipWhiteList.build(),
        factories.schema.build(),
        factories.auth.build(),
      );

      (renderingPermissionService.getScope as jest.Mock).mockResolvedValue('scope');

      const result = await forestAdminClient.getScope({
        renderingId: 666,
        collectionName: 'jedis',
        userId: 42,
      });

      expect(renderingPermissionService.getScope).toHaveBeenCalledWith({
        collectionName: 'jedis',
        renderingId: 666,
        userId: 42,
      });
      expect(result).toBe('scope');
    });
  });
});
