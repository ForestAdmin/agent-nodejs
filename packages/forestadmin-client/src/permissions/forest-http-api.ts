import { EnvironmentPermissionsV4, RenderingPermissionV4, UserPermissionV4 } from './types';
import { ModelCustomization, WebhookActionConfigurationApi } from '../model-customizations/types';
import { ForestAdminClientOptionsWithDefaults, ForestAdminServerInterface } from '../types';
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
    return ServerUtils.query<ModelCustomization<WebhookActionConfigurationApi>[]>(
      options,
      'get',
      '/liana/model-customizations',
    );
  }
}
