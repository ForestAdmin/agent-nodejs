import ForestAdminClient from '../src/forest-admin-client-with-cache';
import verifyAndExtractApproval from '../src/permissions/verify-approval';
import * as factories from './__factories__';

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
      );

      const config = await forestAdminClient.getIpWhitelistConfiguration();
      expect(config).toStrictEqual({ isFeatureEnabled: true, ipRules: [] });
      expect(whiteListService.getConfiguration).toHaveBeenCalledTimes(1);
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
      );

      verifyAndExtractApprovalMock.mockReturnValue(signedParameters);

      const result = forestAdminClient.verifySignedActionParameters(signedParameters);

      expect(result).toBe(signedParameters);
      expect(verifyAndExtractApprovalMock).toHaveBeenCalledWith(signedParameters, 'secret');
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
