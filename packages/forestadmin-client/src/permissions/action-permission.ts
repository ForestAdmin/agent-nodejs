import hashObject from 'object-hash';

import { ForestAdminClientOptionsWithDefaults } from '../types';
import { GenericTreeWithSources } from './types';
import ForestHttpApi from './forest-http-api';
import generateActionsFromPermissions, {
  ActionPermissions,
} from './generate-actions-from-permissions';

export default class ActionPermissionService {
  private permissionsPromise: Promise<ActionPermissions> | undefined;
  private permissionExpirationTimestamp: number | undefined;

  constructor(private readonly options: ForestAdminClientOptionsWithDefaults) {}

  public canOneOf(userId: string, actionNames: string[]): Promise<boolean> {
    return this.hasPermissionOrRefetch({
      userId,
      actionNames,
      allowRefetch: true,
    });
  }

  public can(userId: string, actionName: string): Promise<boolean> {
    return this.hasPermissionOrRefetch({
      userId,
      actionNames: [actionName],
      allowRefetch: true,
    });
  }

  private async hasPermissionOrRefetch({
    userId,
    actionNames,
    allowRefetch,
  }: {
    userId: string;
    actionNames: string[];
    allowRefetch: boolean;
  }): Promise<boolean> {
    const permissions = await this.getPermissions();
    const isAllowed = this.isAllowedOneOf({ permissions, actionNames, userId });

    if (!isAllowed && allowRefetch) {
      this.permissionsPromise = undefined;
      this.permissionExpirationTimestamp = undefined;

      return this.hasPermissionOrRefetch({
        userId,
        actionNames,
        allowRefetch: false,
      });
    }

    this.options.logger(
      'Debug',
      `User ${userId} is ${isAllowed ? '' : 'not '}allowed to perform ${
        actionNames.length > 1 ? ' one of ' : ''
      }${actionNames.join(', ')}`,
    );

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
    return Boolean(
      permissions.everythingAllowed ||
        permissions.actionsGloballyAllowed.has(actionName) ||
        permissions.actionsAllowedByUser.get(actionName)?.has(userId),
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

    const [rawPermissions, users] = await Promise.all([
      ForestHttpApi.getEnvironmentPermissions(this.options),
      ForestHttpApi.getUsers(this.options),
    ]);

    return generateActionsFromPermissions(rawPermissions, users);
  }

  public async getCustomActionConditionForUser(userId: string, actionName: string) {
    const permissions = await this.getPermissions();
    const userInfo = permissions.users.find(user => `${user.id}` === userId);

    const conditionFilter = permissions.actionsConditionByRoleId
      .get(actionName)
      .get(userInfo.roleId);

    return conditionFilter;
  }

  public async getAllCustomActionConditions(actionName: string) {
    const permissions = await this.getPermissions();
    const actionConditionsByRoleId = permissions.actionsConditionByRoleId.get(actionName);

    const rolesIdsGroupByConditions = Array.from(
      actionConditionsByRoleId,
      ([roleId, filterGenericTree]) => {
        return {
          roleId,
          filterGenericTree,
          filterGenericTreeHash: hashObject(filterGenericTree, { respectType: false }),
        };
      },
    ).reduce((acc, current) => {
      const { roleId, filterGenericTree, filterGenericTreeHash } = current;

      if (acc.has(filterGenericTreeHash)) {
        acc.get(filterGenericTreeHash).roleIds.push(roleId);
      } else {
        acc.set(filterGenericTreeHash, { roleIds: [roleId], filterGenericTree });
      }

      return acc;
    }, new Map<string, { roleIds: number[]; filterGenericTree: GenericTreeWithSources }>());

    return Array.from(rolesIdsGroupByConditions.values());
  }
}
