import type { CollectionRenderingPermissionV4, RawTree, Team, UserPermissionV4 } from './types';
import type UserPermissionService from './user-permission';
import type { Chart, QueryChart } from '../charts/types';
import type { ForestAdminClientOptionsWithDefaults, ForestAdminServerInterface } from '../types';

import { hashChartRequest, hashServerCharts } from './hash-chart';
import isSegmentQueryAllowedOnConnection from './is-segment-query-allowed-on-connection';
import isSegmentQueryAllowed from './is-segment-query-authorized';
import { PermissionLevel } from './types';
import verifySQLQuery from './verify-sql-query';
import ContextVariables from '../utils/context-variables';
import ContextVariablesInjector from '../utils/context-variables-injector';
import TTLCache from '../utils/ttl-cache';

export type RenderingPermission = {
  team: Team;
  collections: Record<string, CollectionRenderingPermissionV4>;
  charts: Set<string>;
};

export default class RenderingPermissionService {
  private readonly permissionsByRendering: TTLCache<RenderingPermission>;

  constructor(
    private readonly options: ForestAdminClientOptionsWithDefaults,
    private readonly userPermissions: UserPermissionService,
    private readonly forestAdminServerInterface: ForestAdminServerInterface,
  ) {
    this.permissionsByRendering = new TTLCache(
      async renderingId => this.loadPermissions(Number(renderingId)),
      this.options.permissionsCacheDurationInSeconds * 1000,
    );
  }

  public async getScope({
    renderingId,
    collectionName,
    userId,
  }: {
    renderingId: number | string;
    collectionName: string;
    userId: number | string;
  }): Promise<RawTree> {
    return this.getScopeOrRetry({
      renderingId,
      collectionName,
      userId,
      // Only allow retry when not using server events
      allowRetry: !this.options.instantCacheRefresh,
    });
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
  }): Promise<RawTree> {
    const [permissions, userInfo] = await Promise.all([
      this.permissionsByRendering.fetch(`${renderingId}`),
      this.userPermissions.getUserInfo(userId),
    ]);

    const collectionPermissions = permissions?.collections?.[collectionName];

    if (!collectionPermissions) {
      if (allowRetry) {
        this.invalidateCache(renderingId);

        return this.getScopeOrRetry({
          renderingId,
          collectionName,
          userId,
          allowRetry: false,
        });
      }

      return null;
    }

    return ContextVariablesInjector.injectContextInFilter(
      collectionPermissions.scope,
      new ContextVariables({ team: permissions.team, user: userInfo }),
    );
  }

  public async canExecuteSegmentQuery({
    renderingId,
    collectionName,
    segmentQuery,
    connectionName,
    userId,
  }: {
    renderingId: number | string;
    collectionName: string;
    segmentQuery: string;
    connectionName?: string;
    userId: number;
  }): Promise<boolean> {
    return (
      (await this.canExecuteSegmentQueryOrRetry({
        renderingId,
        collectionName,
        segmentQuery,
        connectionName,
        userId,
        // Only allow retry when not using server events
        allowRetry: !this.options.instantCacheRefresh,
      })) && verifySQLQuery(segmentQuery)
    );
  }

  private async canExecuteSegmentQueryOrRetry({
    renderingId,
    collectionName,
    segmentQuery,
    connectionName,
    allowRetry,
    userId,
  }: {
    renderingId: number | string;
    collectionName: string;
    segmentQuery: string;
    connectionName?: string;
    allowRetry: boolean;
    userId: number;
  }): Promise<boolean> {
    const [userInfo, permissions] = await Promise.all([
      this.userPermissions.getUserInfo(userId),
      this.permissionsByRendering.fetch(`${renderingId}`),
    ]);

    if (
      [PermissionLevel.Admin, PermissionLevel.Developer, PermissionLevel.Editor].includes(
        userInfo?.permissionLevel,
      )
    ) {
      this.options.logger(
        'Debug',
        `User ${userId} can retrieve SQL segment on rendering ${renderingId}`,
      );

      return true;
    }

    const collectionPermissions = permissions?.collections?.[collectionName];

    if (
      !collectionPermissions ||
      (connectionName &&
        !isSegmentQueryAllowedOnConnection(collectionPermissions, segmentQuery, connectionName)) ||
      !isSegmentQueryAllowed(segmentQuery, collectionPermissions.segments)
    ) {
      if (allowRetry) {
        this.invalidateCache(renderingId);

        return this.canExecuteSegmentQueryOrRetry({
          renderingId,
          collectionName,
          segmentQuery,
          connectionName,
          userId,
          allowRetry: false,
        });
      }

      this.options.logger(
        'Debug',
        `User ${userId} cannot retrieve SQL segment on rendering ${renderingId}`,
      );

      return false;
    }

    this.options.logger(
      'Debug',
      `User ${userId} can retrieve SQL segment on rendering ${renderingId}`,
    );

    return true;
  }

  private async loadPermissions(renderingId: number): Promise<RenderingPermission> {
    this.options.logger('Debug', `Loading rendering permissions for rendering ${renderingId}`);

    const rawPermissions = await this.forestAdminServerInterface.getRenderingPermissions(
      renderingId,
      this.options,
    );
    const charts = hashServerCharts(rawPermissions.stats);

    return {
      team: rawPermissions.team,
      collections: rawPermissions.collections,
      charts,
    };
  }

  private isQueryChart(chartRequest: Chart): chartRequest is QueryChart {
    return 'query' in chartRequest;
  }

  public async canExecuteChart({
    renderingId,
    chartRequest,
    userId,
  }: {
    renderingId: number | string;
    chartRequest: Chart;
    userId: number | string;
  }): Promise<boolean> {
    const chartHash = hashChartRequest(chartRequest);

    return (
      (await this.canRetrieveChartHashOrRetry({
        renderingId,
        chartHash,
        userId,
        // Only allow retry when not using server events
        allowRetry: !this.options.instantCacheRefresh,
      })) &&
      (!this.isQueryChart(chartRequest) || verifySQLQuery(chartRequest.query))
    );
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
      this.userPermissions.invalidateCache();

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

  public invalidateAllCache() {
    this.options.logger('Debug', `Invalidating rendering permissions cache for all renderings`);

    this.permissionsByRendering.clear();
  }

  public async getUser(userId: number | string): Promise<UserPermissionV4> {
    return this.userPermissions.getUserInfo(userId);
  }

  public async getTeam(renderingId: number | string): Promise<Team> {
    const permissions = await this.permissionsByRendering.fetch(`${renderingId}`);

    return permissions.team;
  }
}
