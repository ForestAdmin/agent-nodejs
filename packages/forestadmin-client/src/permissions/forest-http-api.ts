import { ForestServerRepository, HttpOptions } from '../types';
import ServerUtils from '../utils/server';
import { EnvironmentPermissionsV4, RenderingPermissionV4, UserPermissionV4 } from './types';

export default class ForestHttpApi implements ForestServerRepository {
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
}
