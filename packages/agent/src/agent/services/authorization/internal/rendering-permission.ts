import { GenericTree } from '@forestadmin/datasource-toolkit';
import LruCache from 'lru-cache';

import { AgentOptionsWithDefaults } from '../../../types';
import {
  CollectionRenderingPermissionV4,
  PermissionLevel,
  RenderingPermissionV4,
  Team,
  User,
  UserPermissionV4,
} from './types';
import { hashChartRequest, hashServerCharts } from './hash-chart';
import ForestHttpApi from '../../../utils/forest-http-api';
import UserPermissionService from './user-permission';
import generateUserScope from './generate-user-scope';

export type RenderingPermissionOptions = Pick<
  AgentOptionsWithDefaults,
  'forestServerUrl' | 'envSecret' | 'isProduction' | 'permissionsCacheDurationInSeconds'
>;

type RenderingPermission = {
  team: Team;
  collections: Record<string, CollectionRenderingPermissionV4>;
  charts: Set<string>;
};

export default class RenderingPermissionService {
  private readonly permissionsByRendering: LruCache<string, RenderingPermission>;

  constructor(
    private readonly options: RenderingPermissionOptions,
    private readonly userPermissions: UserPermissionService,
  ) {
    this.permissionsByRendering = new LruCache({
      max: 256,
      ttl: this.options.permissionsCacheDurationInSeconds * 1000,
      fetchMethod: renderingId => this.loadPermissions(renderingId),
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
        this.invalidateCache(renderingId);

        return this.getScopeOrRetry({ renderingId, collectionName, user, allowRetry: false });
      }

      return null;
    }

    return generateUserScope(collectionPermissions.scope, permissions.team, userInfo);
  }

  private async loadPermissions(renderingId: number): Promise<RenderingPermission> {
    const rawPermissions = await ForestHttpApi.getRenderingPermissions(renderingId, this.options);

    return {
      team: rawPermissions.team,
      collections: rawPermissions.collections,
      charts: hashServerCharts(rawPermissions.stats),
    };
  }

  public async canRetrieveChart({
    renderingId,
    chartRequest,
    userId,
  }: {
    renderingId: number;
    chartRequest: any;
    userId: number;
  }): Promise<boolean> {
    const chartHash = hashChartRequest(chartRequest);

    return this.canRetrieveChartHashOrRetry({ renderingId, chartHash, userId, allowRetry: true });
  }

  private async canRetrieveChartHashOrRetry({
    renderingId,
    userId,
    chartHash,
    allowRetry,
  }: {
    renderingId: number;
    userId: number;
    chartHash: string;
    allowRetry: boolean;
  }): Promise<boolean> {
    const [userInfo, permissions] = await Promise.all([
      this.userPermissions.getUserInfo(userId),
      this.permissionsByRendering.fetch(renderingId),
    ]);

    if (
      [PermissionLevel.Admin, PermissionLevel.Developer].includes(userInfo?.permissionLevel) ||
      permissions.charts.has(chartHash)
    ) {
      return true;
    }

    if (allowRetry) {
      this.invalidateCache(renderingId);
      this.userPermissions.clearCache();

      return this.canRetrieveChartHashOrRetry({
        renderingId,
        userId,
        chartHash,
        allowRetry: false,
      });
    }

    return false;
  }

  public invalidateCache(renderingId) {
    this.permissionsByRendering.del(renderingId);
  }
}
