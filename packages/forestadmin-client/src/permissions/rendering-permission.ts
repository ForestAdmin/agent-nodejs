import LruCache from 'lru-cache';
import type { GenericTree } from '@forestadmin/datasource-toolkit';

import { CollectionRenderingPermissionV4, PermissionLevel, Team, UserPermissionV4 } from './types';
import { ForestAdminClientOptionsWithDefaults } from '../types';
import { hashChartRequest, hashServerCharts } from './hash-chart';
import ForestHttpApi from './forest-http-api';
import UserPermissionService from './user-permission';
import generateUserScope from './generate-user-scope';
import isSegmentQueryAllowed from './is-segment-query-authorized';

export type RenderingPermission = {
  team: Team;
  collections: Record<string, CollectionRenderingPermissionV4>;
  charts: Set<string>;
};

export default class RenderingPermissionService {
  protected readonly permissionsByRendering: LruCache<string, RenderingPermission>;

  constructor(
    private readonly options: ForestAdminClientOptionsWithDefaults,
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
    userId,
  }: {
    renderingId: number | string;
    collectionName: string;
    userId: number | string;
  }): Promise<GenericTree> {
    return this.getScopeOrRetry({ renderingId, collectionName, userId, allowRetry: true });
  }

  private async getScopeOrRetry({
    renderingId,
    collectionName,
    userId,
    allowRetry,
  }: {
    renderingId: number | string;
    collectionName: string;
    userId: number | string;
    allowRetry: boolean;
  }): Promise<GenericTree> {
    const [permissions, userInfo]: [RenderingPermission, UserPermissionV4] = await Promise.all([
      this.permissionsByRendering.fetch(`${renderingId}`),
      this.userPermissions.getUserInfo(userId),
    ]);

    const collectionPermissions = permissions?.collections?.[collectionName];

    if (!collectionPermissions) {
      if (allowRetry) {
        this.invalidateCache(renderingId);

        return this.getScopeOrRetry({ renderingId, collectionName, userId, allowRetry: false });
      }

      return null;
    }

    return generateUserScope(collectionPermissions.scope, permissions.team, userInfo);
  }

  public async canExecuteSegmentQuery({
    renderingId,
    collectionName,
    segmentQuery,
  }: {
    renderingId: number | string;
    collectionName: string;
    segmentQuery: string;
  }): Promise<boolean> {
    return this.canExecuteSegmentQueryOrRetry({
      renderingId,
      collectionName,
      segmentQuery,
      allowRetry: true,
    });
  }

  private async canExecuteSegmentQueryOrRetry({
    renderingId,
    collectionName,
    segmentQuery,
    allowRetry,
  }: {
    renderingId: number | string;
    collectionName: string;
    segmentQuery: string;
    allowRetry: boolean;
  }): Promise<boolean> {
    const permissions: RenderingPermission = await this.permissionsByRendering.fetch(
      `${renderingId}`,
    );

    const collectionPermissions = permissions?.collections?.[collectionName];

    if (
      !collectionPermissions ||
      !isSegmentQueryAllowed(segmentQuery, collectionPermissions.segments)
    ) {
      if (allowRetry) {
        this.invalidateCache(renderingId);

        return this.canExecuteSegmentQueryOrRetry({
          renderingId,
          collectionName,
          segmentQuery,
          allowRetry: false,
        });
      }

      this.options.logger('Debug', `User cannot retrieve SQL segment on rendering ${renderingId}`);

      return false;
    }

    this.options.logger('Debug', `User can retrieve SQL segment on rendering ${renderingId}`);

    return true;
  }

  private async loadPermissions(renderingId: number): Promise<RenderingPermission> {
    this.options.logger('Debug', `Loading rendering permissions for rendering ${renderingId}`);

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
    renderingId: number | string;
    chartRequest: unknown;
    userId: number | string;
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
    renderingId: number | string;
    userId: number | string;
    chartHash: string;
    allowRetry: boolean;
  }): Promise<boolean> {
    const [userInfo, permissions] = await Promise.all([
      this.userPermissions.getUserInfo(userId),
      this.permissionsByRendering.fetch(`${renderingId}`),
    ]);

    if (
      [PermissionLevel.Admin, PermissionLevel.Developer, PermissionLevel.Editor].includes(
        userInfo?.permissionLevel,
      ) ||
      permissions.charts.has(chartHash)
    ) {
      this.options.logger('Debug', `User ${userId} can retrieve chart on rendering ${renderingId}`);

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

    this.options.logger(
      'Debug',
      `User ${userId} cannot retrieve chart on rendering ${renderingId}`,
    );

    return false;
  }

  public invalidateCache(renderingId: number | string) {
    this.options.logger(
      'Debug',
      `Invalidating rendering permissions cache for rendering ${renderingId}`,
    );

    this.permissionsByRendering.delete(`${renderingId}`);
  }
}
