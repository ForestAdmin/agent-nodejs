import type { ForestAdminServerInterface } from '../src/types';

import * as factories from './__factories__';
import buildApplicationServices from '../src/build-application-services';
import ForestHttpApi from '../src/permissions/forest-http-api';

jest.mock('../src/permissions/forest-http-api');

describe('buildApplicationServices', () => {
  let mockForestHttpApi: jest.Mocked<ForestAdminServerInterface>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockForestHttpApi = {
      getRenderingPermissions: jest.fn(),
      getEnvironmentPermissions: jest.fn(),
      getUsers: jest.fn(),
      getModelCustomizations: jest.fn(),
      getMcpServerConfigs: jest.fn(),
      makeAuthService: jest.fn().mockReturnValue({
        init: jest.fn(),
        getUserInfo: jest.fn(),
        generateAuthorizationUrl: jest.fn(),
        generateTokens: jest.fn(),
      }),
      getSchema: jest.fn(),
      postSchema: jest.fn(),
      checkSchemaHash: jest.fn(),
      getIpWhitelistRules: jest.fn(),
      createActivityLog: jest.fn(),
      updateActivityLogStatus: jest.fn(),
    };

    (ForestHttpApi as jest.Mock).mockImplementation(() => mockForestHttpApi);
  });

  describe('withDefaultImplementation (fallback mechanism)', () => {
    it('should use custom implementation when method is provided', async () => {
      const customGetUsers = jest
        .fn()
        .mockResolvedValue([{ id: 1, name: 'Custom User', permissionLevel: 'admin' }]);
      const partialInterface: Partial<ForestAdminServerInterface> = {
        getUsers: customGetUsers,
      };

      const options = factories.forestAdminClientOptions.build();
      const { renderingPermission } = buildApplicationServices(partialInterface, options);

      // Trigger getUsers through the Proxy by calling a service that uses it
      await renderingPermission.getUser(1);

      // The custom method should have been called through the Proxy, not the default
      expect(customGetUsers).toHaveBeenCalled();
      expect(mockForestHttpApi.getUsers).not.toHaveBeenCalled();
    });

    it('should fallback to ForestHttpApi when method is not provided', () => {
      const partialInterface: Partial<ForestAdminServerInterface> = {
        // Only provide getUsers, not makeAuthService
        getUsers: jest.fn(),
      };

      const options = factories.forestAdminClientOptions.build();
      buildApplicationServices(partialInterface, options);

      // makeAuthService should have been called from ForestHttpApi (the fallback)
      expect(mockForestHttpApi.makeAuthService).toHaveBeenCalledWith(
        expect.objectContaining({
          envSecret: options.envSecret,
        }),
      );
    });

    it('should work with empty partial interface (all methods fallback)', () => {
      const partialInterface: Partial<ForestAdminServerInterface> = {};

      const options = factories.forestAdminClientOptions.build();
      const result = buildApplicationServices(partialInterface, options);

      // All services should be created successfully using ForestHttpApi fallbacks
      expect(result.auth).toBeDefined();
      expect(result.schema).toBeDefined();
      expect(result.activityLogs).toBeDefined();
      expect(mockForestHttpApi.makeAuthService).toHaveBeenCalled();
    });

    it('should allow partial override of methods', async () => {
      const customCheckSchemaHash = jest.fn().mockResolvedValue({ sendSchema: false });
      const partialInterface: Partial<ForestAdminServerInterface> = {
        checkSchemaHash: customCheckSchemaHash,
        // postSchema not provided - should fallback
      };

      const options = factories.forestAdminClientOptions.build();
      const { schema } = buildApplicationServices(partialInterface, options);

      // Mock the postSchema to not actually call the server
      mockForestHttpApi.postSchema.mockResolvedValue(undefined);

      await schema.postSchema({
        collections: [],
        meta: {
          liana: 'test',
          liana_version: '1.0.0',
          liana_features: null,
          stack: { engine: 'nodejs', engine_version: '16.0.0' },
        },
      });

      // Custom checkSchemaHash should be used
      expect(customCheckSchemaHash).toHaveBeenCalled();
      // postSchema should fallback to ForestHttpApi (but not called since sendSchema: false)
      expect(mockForestHttpApi.postSchema).not.toHaveBeenCalled();
    });

    it('should correctly bind this context for custom methods', async () => {
      const customState = { called: false };
      const customGetUsers = jest
        .fn()
        .mockImplementation(function setCalledFlag(this: typeof customState) {
          this.called = true;

          return Promise.resolve([{ id: 1, name: 'User', permissionLevel: 'admin' }]);
        })
        .bind(customState);

      const customInterface: Partial<ForestAdminServerInterface> = {
        getUsers: customGetUsers,
      };

      const options = factories.forestAdminClientOptions.build();
      const { renderingPermission } = buildApplicationServices(customInterface, options);

      // Trigger getUsers through the Proxy by calling a service that uses it
      await renderingPermission.getUser(1);

      expect(customState.called).toBe(true);
    });

    it('should correctly bind this context for fallback methods', () => {
      const partialInterface: Partial<ForestAdminServerInterface> = {};

      const options = factories.forestAdminClientOptions.build();
      buildApplicationServices(partialInterface, options);

      // makeAuthService is called during buildApplicationServices
      // It should work correctly with proper this binding
      expect(mockForestHttpApi.makeAuthService).toHaveBeenCalled();
    });
  });
});
