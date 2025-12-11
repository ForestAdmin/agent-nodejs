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
        factories.modelCustomization.build(),
        factories.mcpServerConfig.build(),
        factories.eventsSubscription.build(),
        factories.eventsHandler.build(),
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
        factories.modelCustomization.build(),
        factories.mcpServerConfig.build(),
        factories.eventsSubscription.build(),
        factories.eventsHandler.build(),
      );

      const result = await forestAdminClient.postSchema({
        collections: [],
        meta: {
          liana: 'forest-nodejs-agent',
          liana_version: '1.0.0',
          liana_features: null,
          ai_llms: null,
          stack: { engine: 'nodejs', engine_version: '16.0.0' },
        },
      });
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
        factories.modelCustomization.build(),
        factories.mcpServerConfig.build(),
        factories.eventsSubscription.build(),
        factories.eventsHandler.build(),
      );

      verifyAndExtractApprovalMock.mockReturnValue(signedParameters);

      const result = forestAdminClient.verifySignedActionParameters(signedParameters);

      expect(result).toBe(signedParameters);
      expect(verifyAndExtractApprovalMock).toHaveBeenCalledWith(signedParameters, 'secret');
    });
  });

  describe('markScopesAsUpdated', () => {
    describe('when not using ServerEvents', () => {
      it('should invalidate the cache of scopes', async () => {
        const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
        const forestAdminClient = new ForestAdminClient(
          { ...factories.forestAdminClientOptions.build(), instantCacheRefresh: false },
          factories.permission.build(),
          renderingPermissionService,
          factories.contextVariablesInstantiator.build(),
          factories.chartHandler.build(),
          factories.ipWhiteList.build(),
          factories.schema.build(),
          factories.auth.build(),
          factories.modelCustomization.build(),
          factories.mcpServerConfig.build(),
          factories.eventsSubscription.build(),
          factories.eventsHandler.build(),
        );

        await forestAdminClient.markScopesAsUpdated(42);

        expect(renderingPermissionService.invalidateCache).toHaveBeenCalledWith(42);
      });
    });

    describe('when using ServerEvents', () => {
      it('should not do anything', async () => {
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
          factories.modelCustomization.build(),
          factories.mcpServerConfig.build(),
          factories.eventsSubscription.build(),
          factories.eventsHandler.build(),
        );

        await forestAdminClient.markScopesAsUpdated(42);

        expect(renderingPermissionService.invalidateCache).not.toHaveBeenCalled();
      });
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
        factories.modelCustomization.build(),
        factories.mcpServerConfig.build(),
        factories.eventsSubscription.build(),
        factories.eventsHandler.build(),
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

  describe('subscribeToServerEvents', () => {
    it('should subscribes to Server Events service', async () => {
      const eventsSubscriptionService = factories.eventsSubscription.mockAllMethods().build();
      const forestAdminClient = new ForestAdminClient(
        factories.forestAdminClientOptions.build(),
        factories.permission.build(),
        factories.renderingPermission.build(),
        factories.contextVariablesInstantiator.build(),
        factories.chartHandler.build(),
        factories.ipWhiteList.build(),
        factories.schema.build(),
        factories.auth.build(),
        factories.modelCustomization.build(),
        factories.mcpServerConfig.build(),
        eventsSubscriptionService,
        factories.eventsHandler.build(),
      );

      await forestAdminClient.subscribeToServerEvents();

      expect(eventsSubscriptionService.subscribeEvents).toHaveBeenCalledWith();
    });
  });

  describe('close', () => {
    it('should close', () => {
      const eventsSubscriptionService = factories.eventsSubscription.mockAllMethods().build();
      const forestAdminClient = new ForestAdminClient(
        factories.forestAdminClientOptions.build(),
        factories.permission.build(),
        factories.renderingPermission.build(),
        factories.contextVariablesInstantiator.build(),
        factories.chartHandler.build(),
        factories.ipWhiteList.build(),
        factories.schema.build(),
        factories.auth.build(),
        factories.modelCustomization.build(),
        factories.mcpServerConfig.build(),
        eventsSubscriptionService,
        factories.eventsHandler.build(),
      );

      forestAdminClient.close();

      expect(eventsSubscriptionService.close).toHaveBeenCalledWith();
    });
  });

  describe('onRefreshCustomizations', () => {
    it('should subscribes the handler to the eventsHandler service', async () => {
      const eventsHandlerService = factories.eventsHandler.mockAllMethods().build();
      const forestAdminClient = new ForestAdminClient(
        factories.forestAdminClientOptions.build({ experimental: { fakeCustomization: true } }),
        factories.permission.build(),
        factories.renderingPermission.build(),
        factories.contextVariablesInstantiator.build(),
        factories.chartHandler.build(),
        factories.ipWhiteList.build(),
        factories.schema.build(),
        factories.auth.build(),
        factories.modelCustomization.build(),
        factories.mcpServerConfig.build(),
        factories.eventsSubscription.build(),
        eventsHandlerService,
      );

      const handler = jest.fn();

      forestAdminClient.onRefreshCustomizations(handler);

      expect(eventsHandlerService.onRefreshCustomizations).toHaveBeenCalled();
      expect(eventsHandlerService.onRefreshCustomizations).toHaveBeenCalledWith(handler);
    });

    describe('without any "experimental" option', () => {
      it('should not subscribes the handler to the eventsHandler service', async () => {
        const eventsHandlerService = factories.eventsHandler.mockAllMethods().build();
        const forestAdminClient = new ForestAdminClient(
          factories.forestAdminClientOptions.build(),
          factories.permission.build(),
          factories.renderingPermission.build(),
          factories.contextVariablesInstantiator.build(),
          factories.chartHandler.build(),
          factories.ipWhiteList.build(),
          factories.schema.build(),
          factories.auth.build(),
          factories.modelCustomization.build(),
          factories.mcpServerConfig.build(),
          factories.eventsSubscription.build(),
          eventsHandlerService,
        );

        const handler = jest.fn();

        forestAdminClient.onRefreshCustomizations(handler);

        expect(eventsHandlerService.onRefreshCustomizations).not.toHaveBeenCalled();
      });
    });
  });
});
