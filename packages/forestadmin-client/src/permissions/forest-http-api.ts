import type { EnvironmentPermissionsV4, RenderingPermissionV4, UserPermissionV4 } from './types';
import type { ModelCustomization } from '../model-customizations/types';
import type {
  ForestAdminAuthServiceInterface,
  ForestAdminClientOptions,
  ForestAdminClientOptionsWithDefaults,
  ForestAdminServerInterface,
} from '../types';
import type { McpConfiguration } from '@forestadmin/ai-proxy';

import AuthService from '../auth';
import ServerUtils from '../utils/server';

export type HttpOptions = Pick<
  ForestAdminClientOptionsWithDefaults,
  'envSecret' | 'forestServerUrl'
>;

export default class ForestHttpApi implements ForestAdminServerInterface {
  async getEnvironmentPermissions(options: HttpOptions): Promise<EnvironmentPermissionsV4> {
    return ServerUtils.query(options, 'get', '/liana/v4/permissions/environment');
  }

  async getUsers(options: HttpOptions): Promise<UserPermissionV4[]> {
    return ServerUtils.query(options, 'get', '/liana/v4/permissions/users');
  }

  async getRenderingPermissions(
    renderingId: number,
    options: HttpOptions,
  ): Promise<RenderingPermissionV4> {
    return ServerUtils.query(options, 'get', `/liana/v4/permissions/renderings/${renderingId}`);
  }

  async getModelCustomizations(options: HttpOptions): Promise<ModelCustomization[]> {
    return ServerUtils.query<ModelCustomization[]>(options, 'get', '/liana/model-customizations');
  }

  async getMcpServerConfigs(options: HttpOptions): Promise<McpConfiguration> {
    return ServerUtils.query<McpConfiguration>(
      options,
      'get',
      '/liana/mcp-server-configs-with-details',
    );
  }

  makeAuthService(options: Required<ForestAdminClientOptions>): ForestAdminAuthServiceInterface {
    return new AuthService(options);
  }
}
