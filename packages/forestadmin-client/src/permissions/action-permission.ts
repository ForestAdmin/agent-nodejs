import type { ForestAdminClientOptionsWithDefaults } from '../types';
import type { RawTreeWithSources } from './types';

import ForestHttpApi from './forest-http-api';
import generateActionsFromPermissions, {
  ActionPermissions,
} from './generate-actions-from-permissions';

export default class ActionPermissionService {
  private permissionsPromise: Promise<ActionPermissions> | undefined;
  private permissionExpirationTimestamp: number | undefined;

  constructor(private readonly options: ForestAdminClientOptionsWithDefaults) {}

  public async isEverythingAllowed(): Promise<boolean> {
    const permissions = await this.getPermissions();

    return permissions.everythingAllowed;
  }

  public canOneOf(roleId: number, actionNames: string[]): Promise<boolean> {
    return this.hasPermissionOrRefetch({
      roleId,
      actionNames,
      allowRefetch: true,
    });
  }

  public can(roleId: number, actionName: string): Promise<boolean> {
    return this.hasPermissionOrRefetch({
      roleId,
      actionNames: [actionName],
      allowRefetch: true,
    });
  }

  private async hasPermissionOrRefetch({
    roleId,
    actionNames,
    allowRefetch,
  }: {
    roleId: number;
    actionNames: string[];
    allowRefetch: boolean;
  }): Promise<boolean> {
    const permissions = await this.getPermissions();
    const isAllowed = this.isAllowedOneOf({ permissions, actionNames, roleId });

    if (!isAllowed && allowRefetch) {
      this.permissionsPromise = undefined;
      this.permissionExpirationTimestamp = undefined;

      return this.hasPermissionOrRefetch({
        roleId,
        actionNames,
        allowRefetch: false,
      });
    }

    this.options.logger(
      'Debug',
      `User ${roleId} is ${isAllowed ? '' : 'not '}allowed to perform ${
        actionNames.length > 1 ? ' one of ' : ''
      }${actionNames.join(', ')}`,
    );

    return isAllowed;
  }

  private isAllowedOneOf({
    permissions,
    actionNames,
    roleId,
  }: {
    permissions: ActionPermissions;
    actionNames: string[];
    roleId: number;
  }): boolean {
    return actionNames.some(actionName => this.isAllowed({ permissions, actionName, roleId }));
  }

  private isAllowed({
    permissions,
    actionName,
    roleId,
  }: {
    permissions: ActionPermissions;
    actionName: string;
    roleId: number;
  }): boolean {
    return Boolean(
      permissions.everythingAllowed ||
        permissions.actionsGloballyAllowed.has(actionName) ||
        permissions.actionsByRole.get(actionName)?.allowedRoles.has(roleId),
    );
  }

  private async getPermissions(): Promise<ActionPermissions> {
    if (
      this.permissionsPromise &&
      this.permissionExpirationTimestamp &&
      this.permissionExpirationTimestamp > Date.now()
    ) {
      return this.permissionsPromise;
    }

    this.permissionsPromise = this.fetchEnvironmentPermissions();
    this.permissionExpirationTimestamp =
      Date.now() + this.options.permissionsCacheDurationInSeconds * 1000;

    return this.permissionsPromise;
  }

  private async fetchEnvironmentPermissions(): Promise<ActionPermissions> {
    this.options.logger('Debug', 'Fetching environment permissions');

    const rawPermissions = await ForestHttpApi.getEnvironmentPermissions(this.options);

    return generateActionsFromPermissions(rawPermissions);
  }

  public async getCustomActionCondition(
    roleId: number,
    actionName: string,
  ): Promise<RawTreeWithSources | undefined> {
    const permissions = await this.getPermissions();

    const conditionFilter = permissions.actionsByRole.get(actionName)?.conditionsByRole.get(roleId);

    return conditionFilter;
  }

  public async getAllCustomActionConditions(
    actionName: string,
  ): Promise<Map<number, RawTreeWithSources> | undefined> {
    const permissions = await this.getPermissions();

    return permissions.actionsByRole.get(actionName)?.conditionsByRole;
  }

  public async getRoleIdsAllowedToApproveWithoutConditions(
    actionName: string,
  ): Promise<Array<number>> {
    const permissions = await this.getPermissions();

    const approvalPermission = permissions.actionsByRole.get(actionName);

    if (!approvalPermission) {
      return [];
    }

    // All allowed roles excluding the one with conditions
    return Array.from(approvalPermission.allowedRoles).filter(
      roleId => !approvalPermission.conditionsByRole?.has(roleId),
    );
  }
}
