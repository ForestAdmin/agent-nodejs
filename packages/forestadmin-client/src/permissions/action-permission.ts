import { ForestAdminClientOptionsWithDefaults } from '../types';
import ForestHttpApi from './forest-http-api';
import generateActionsFromPermissions, {
  ActionPermissions,
} from './generate-actions-from-permissions';

export default class ActionPermissionService {
  private permissionsPromise: Promise<ActionPermissions> | undefined;
  private permissionExpirationTimestamp: number | undefined;

  constructor(private readonly options: ForestAdminClientOptionsWithDefaults) {}

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

  public async getCustomActionConditionForUser(userId: string, actionName: string) {
    const permissions = await this.getPermissions();
    const userInfo = permissions.users.find(user => `${user.id}` === userId);

    const conditionFilter = permissions.actionsConditionByRoleId
      .get(actionName)
      ?.get(userInfo.roleId);

    return conditionFilter;
  }

  public async getAllCustomActionConditions(actionName: string) {
    const permissions = await this.getPermissions();

    return permissions.actionsConditionByRoleId.get(actionName);
  }

  public async getRoleIdsAllowedToApproveWithoutConditions(actionName: string) {
    const permissions = await this.getPermissions();

    const rawActionPermission = permissions.actionsRawRights[actionName];

    // I was wrong this cannot happen
    if (typeof rawActionPermission.description === 'boolean') {
      if (rawActionPermission.description === true) {
        // All roles are allowed
        return permissions.allRoleIds;
      }

      return []; // No allowed roles
    }

    // roleByUser .get(userId) => roleId

    // actions.get(actionName + ':approval') => {
    // rolesAllowed: Set<number>()

    // specificToRoleId only exist is there's a condition for this action for a specific role
    // specificToRoleId: new Map<roleId, specific>
    // }

    // This is true
    if (!rawActionPermission.conditions) {
      // Without condition allowed roles are simply the role allowed to approve
      return rawActionPermission.description.roles;
    }

    // All allowed roles excluding the one with conditions
    return rawActionPermission.description.roles.filter(
      roleId => !rawActionPermission.conditions.find(item => item.roleId === roleId),
    );
  }
}
