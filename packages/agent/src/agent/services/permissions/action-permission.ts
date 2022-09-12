import LruCache from 'lru-cache';

import { AgentOptionsWithDefaults } from '../../types';
import ForestHttpApi from '../../utils/forest-http-api';
import generateActionsFromPermissions, {
  ActionPermissions,
} from '../../utils/generate-actions-from-permissions';

export type ActionPermissionOptions = Pick<
  AgentOptionsWithDefaults,
  'forestServerUrl' | 'envSecret' | 'isProduction' | 'permissionsCacheDurationInSeconds'
>;

export default class ActionPermissionService {
  private readonly permissionsByRendering: LruCache<string, Promise<ActionPermissions>>;

  constructor(private readonly options: ActionPermissionOptions) {
    this.permissionsByRendering = new LruCache({
      max: 256,
      ttl: this.options.permissionsCacheDurationInSeconds * 1000,
    });
  }

  public canOneOf(params: {
    userId: string;
    renderingId: string;
    actionNames: string[];
  }): Promise<boolean> {
    return this.hasPermissionOrRefetch({
      userId: params.userId,
      renderingId: params.renderingId,
      actionNames: params.actionNames,
      allowRefetch: true,
    });
  }

  public can(params: {
    userId: string;
    renderingId: string;
    actionName: string;
  }): Promise<boolean> {
    return this.hasPermissionOrRefetch({
      userId: params.userId,
      renderingId: params.renderingId,
      actionNames: [params.actionName],
      allowRefetch: true,
    });
  }

  private async hasPermissionOrRefetch({
    userId,
    renderingId,
    actionNames,
    allowRefetch,
  }: {
    userId: string;
    renderingId: string;
    actionNames: string[];
    allowRefetch: boolean;
  }): Promise<boolean> {
    const permissions = await this.getRenderingPermissions(renderingId);
    const isAllowed = this.isAllowedOneOf({ permissions, actionNames, userId });

    if (!isAllowed && allowRefetch) {
      this.permissionsByRendering.del(renderingId);

      return this.hasPermissionOrRefetch({
        userId,
        renderingId,
        actionNames,
        allowRefetch: false,
      });
    }

    return isAllowed;
  }

  private isAllowedOneOf({
    permissions,
    actionNames,
    userId,
  }: {
    permissions: ActionPermissions;
    actionNames: string[];
    userId: string;
  }): boolean {
    return actionNames.some(actionName => this.isAllowed({ permissions, actionName, userId }));
  }

  private isAllowed({
    permissions,
    actionName,
    userId,
  }: {
    permissions: ActionPermissions;
    actionName: string;
    userId: string;
  }): boolean {
    return (
      permissions.everythingAllowed ||
      permissions.actionsGloballyAllowed.has(actionName) ||
      permissions.actionsAllowedByUser.get(actionName)?.has(userId)
    );
  }

  private async getRenderingPermissions(renderingId: string): Promise<ActionPermissions> {
    const cachedPermissions = this.permissionsByRendering.get(renderingId);

    if (cachedPermissions) {
      return cachedPermissions;
    }

    const permissionsPromise = this.fetchEnvironmentPermissions();

    this.permissionsByRendering.set(renderingId, permissionsPromise);

    return permissionsPromise;
  }

  private async fetchEnvironmentPermissions(): Promise<ActionPermissions> {
    const [rawPermissions, roles] = await Promise.all([
      ForestHttpApi.getEnvironmentPermissions(this.options),
      ForestHttpApi.getRoles(this.options),
    ]);

    return generateActionsFromPermissions(rawPermissions, roles);
  }
}
