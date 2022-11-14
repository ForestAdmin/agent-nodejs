import { ForestAdminClientOptionsWithDefaults } from '../types';
import ServerUtils from '../utils/server';
import { EnvironmentPermissionsV4, RenderingPermissionV4, UserPermissionV4 } from './types';

type HttpOptions = Pick<ForestAdminClientOptionsWithDefaults, 'envSecret' | 'forestServerUrl'>;

export default class ForestHttpApi {
  static async getEnvironmentPermissions(options: HttpOptions): Promise<EnvironmentPermissionsV4> {
    return ServerUtils.query(options, 'get', '/liana/v4/permissions/environment');
  }

  static async getUsers(options: HttpOptions): Promise<UserPermissionV4[]> {
    return ServerUtils.query(options, 'get', '/liana/v4/permissions/users');
  }

  static async getRenderingPermissions(
    renderingId: number,
    options: HttpOptions,
  ): Promise<RenderingPermissionV4> {
    return ServerUtils.query(options, 'get', `/liana/v4/permissions/renderings/${renderingId}`);
  }
}
