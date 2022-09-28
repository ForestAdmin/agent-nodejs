import { GenericTree } from '@forestadmin/datasource-toolkit';
import LruCache from 'lru-cache';

import { AgentOptionsWithDefaults } from '../../../types';
import { RenderingPermissionV4, User, UserPermissionV4 } from './types';
import ForestHttpApi from '../../../utils/forest-http-api';
import UserPermissionService from './user-permission';
import generateUserScope from './generate-user-scope';

export type RenderingPermissionOptions = Pick<
  AgentOptionsWithDefaults,
  'forestServerUrl' | 'envSecret' | 'isProduction' | 'permissionsCacheDurationInSeconds'
>;

export default class RenderingPermissionService {
  private readonly permissionsByRendering: LruCache<string, RenderingPermissionV4>;

  constructor(
    private readonly options: RenderingPermissionOptions,
    private readonly userPermissions: UserPermissionService,
  ) {
    this.permissionsByRendering = new LruCache({
      max: 256,
      ttl: this.options.permissionsCacheDurationInSeconds * 1000,
      fetchMethod: renderingId => ForestHttpApi.getRenderingPermissions(renderingId, this.options),
    });
  }

  public async getScope({
    renderingId,
    collectionName,
    user,
  }: {
    renderingId: string;
    collectionName: string;
    user: User;
  }): Promise<GenericTree> {
    return this.getScopeOrRetry({ renderingId, collectionName, user, allowRetry: true });
  }

  private async getScopeOrRetry({
    renderingId,
    collectionName,
    user,
    allowRetry,
  }: {
    renderingId: string;
    collectionName: string;
    user: User;
    allowRetry: boolean;
  }): Promise<GenericTree> {
    const [permissions, userInfo]: [RenderingPermissionV4, UserPermissionV4] = await Promise.all([
      this.permissionsByRendering.fetch(renderingId),
      this.userPermissions.getUserInfo(user.id),
    ]);

    const collectionPermissions = permissions?.collections?.[collectionName];

    if (!collectionPermissions) {
      if (allowRetry) {
        this.permissionsByRendering.del(renderingId);

        return this.getScopeOrRetry({ renderingId, collectionName, user, allowRetry: false });
      }

      return null;
    }

    return generateUserScope(collectionPermissions.scope, permissions.team, userInfo);
  }
}
