import * as factories from './__factories__';
import ForestAdminClient from '../src/forest-admin-client-with-cache';
import verifyAndExtractApproval from '../src/permissions/verify-approval';

jest.mock('../src/permissions/verify-approval', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const verifyAndExtractApprovalMock = verifyAndExtractApproval as jest.Mock;

describe('ForestAdminClientWithCache', () => {
  describe('constructor wiring', () => {
    it('should assign each positional service to its matching property', () => {
      const options = factories.forestAdminClientOptions.build();
      const permissionService = factories.permission.build();
      const renderingPermissionService = factories.renderingPermission.build();
      const contextVariablesInstantiator = factories.contextVariablesInstantiator.build();
      const chartHandler = factories.chartHandler.build();
      const ipWhitelistService = factories.ipWhiteList.build();
      const schemaService = factories.schema.build();
      const activityLogsService = factories.activityLogs.build();
      const authService = factories.auth.build();
      const modelCustomizationService = factories.modelCustomization.build();
      const mcpServerConfigService = factories.mcpServerConfig.build();
      const eventsSubscription = factories.eventsSubscription.build();
      const eventsHandler = factories.eventsHandler.build();
      const workflowsService = factories.workflows.build();

      const forestAdminClient = new ForestAdminClient(
        options,
        permissionService,
        renderingPermissionService,
        contextVariablesInstantiator,
        chartHandler,
        ipWhitelistService,
        schemaService,
        activityLogsService,
        authService,
        modelCustomizationService,
        mcpServerConfigService,
        eventsSubscription,
        eventsHandler,
        workflowsService,
      );

      // All 14 positions, not just the public ones: this test exists to catch a silent argument
      // shift, and two adjacent services of the same shape (eventsSubscription / eventsHandler,
      // renderingPermission / ipWhitelist) would swap unnoticed if only the public members were
      // asserted. Reading the protected ones needs the cast.
      const wired = forestAdminClient as unknown as Record<string, unknown>;

      expect(wired.options).toBe(options);
      expect(wired.permissionService).toBe(permissionService);
      expect(wired.renderingPermissionService).toBe(renderingPermissionService);
      expect(wired.contextVariablesInstantiator).toBe(contextVariablesInstantiator);
      expect(wired.chartHandler).toBe(chartHandler);
      expect(wired.ipWhitelistService).toBe(ipWhitelistService);
      expect(wired.schemaService).toBe(schemaService);
      expect(wired.activityLogsService).toBe(activityLogsService);
      expect(wired.authService).toBe(authService);
      expect(wired.modelCustomizationService).toBe(modelCustomizationService);
      expect(wired.mcpServerConfigService).toBe(mcpServerConfigService);
      expect(wired.eventsSubscription).toBe(eventsSubscription);
      expect(wired.eventsHandler).toBe(eventsHandler);
      expect(wired.workflowsService).toBe(workflowsService);
    });
  });

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
        factories.activityLogs.build(),
        factories.auth.build(),
        factories.modelCustomization.build(),
        factories.mcpServerConfig.build(),
        factories.eventsSubscription.build(),
        factories.eventsHandler.build(),
        factories.workflows.build(),
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
        factories.activityLogs.build(),
        factories.auth.build(),
        factories.modelCustomization.build(),
        factories.mcpServerConfig.build(),
        factories.eventsSubscription.build(),
        factories.eventsHandler.build(),
        factories.workflows.build(),
      );

      const result = await forestAdminClient.postSchema({
        collections: [],
        meta: {
          liana: 'forest-nodejs-agent',
          liana_version: '1.0.0',
          liana_features: null,
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
        factories.activityLogs.build(),
        factories.auth.build(),
        factories.modelCustomization.build(),
        factories.mcpServerConfig.build(),
        factories.eventsSubscription.build(),
        factories.eventsHandler.build(),
        factories.workflows.build(),
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
          factories.activityLogs.build(),
          factories.auth.build(),
          factories.modelCustomization.build(),
          factories.mcpServerConfig.build(),
          factories.eventsSubscription.build(),
          factories.eventsHandler.build(),
          factories.workflows.build(),
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
          factories.activityLogs.build(),
          factories.auth.build(),
          factories.modelCustomization.build(),
          factories.mcpServerConfig.build(),
          factories.eventsSubscription.build(),
          factories.eventsHandler.build(),
          factories.workflows.build(),
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
        factories.activityLogs.build(),
        factories.auth.build(),
        factories.modelCustomization.build(),
        factories.mcpServerConfig.build(),
        factories.eventsSubscription.build(),
        factories.eventsHandler.build(),
        factories.workflows.build(),
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
        factories.activityLogs.build(),
        factories.auth.build(),
        factories.modelCustomization.build(),
        factories.mcpServerConfig.build(),
        eventsSubscriptionService,
        factories.eventsHandler.build(),
        factories.workflows.build(),
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
        factories.activityLogs.build(),
        factories.auth.build(),
        factories.modelCustomization.build(),
        factories.mcpServerConfig.build(),
        eventsSubscriptionService,
        factories.eventsHandler.build(),
        factories.workflows.build(),
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
        factories.activityLogs.build(),
        factories.auth.build(),
        factories.modelCustomization.build(),
        factories.mcpServerConfig.build(),
        factories.eventsSubscription.build(),
        eventsHandlerService,
        factories.workflows.build(),
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
          factories.activityLogs.build(),
          factories.auth.build(),
          factories.modelCustomization.build(),
          factories.mcpServerConfig.build(),
          factories.eventsSubscription.build(),
          eventsHandlerService,
          factories.workflows.build(),
        );

        const handler = jest.fn();

        forestAdminClient.onRefreshCustomizations(handler);

        expect(eventsHandlerService.onRefreshCustomizations).not.toHaveBeenCalled();
      });
    });
  });
});
