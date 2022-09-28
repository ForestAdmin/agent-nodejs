import { AgentOptionsWithDefaults } from '../../../types';
import ForestHttpApi from '../../../utils/forest-http-api';
import generateActionsFromPermissions, {
  ActionPermissions,
} from './generate-actions-from-permissions';

export type ActionPermissionOptions = Pick<
  AgentOptionsWithDefaults,
  'forestServerUrl' | 'envSecret' | 'isProduction' | 'permissionsCacheDurationInSeconds' | 'logger'
>;

export default class ActionPermissionService {
  private permissionsPromise: Promise<ActionPermissions> | undefined;
  private permissionExpirationTimestamp: number | undefined;

  constructor(private readonly options: ActionPermissionOptions) {}

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

    this.options.logger?.call(
      undefined,
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
    return (
      permissions.everythingAllowed ||
      permissions.actionsGloballyAllowed.has(actionName) ||
      permissions.actionsAllowedByUser.get(actionName)?.has(userId)
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
    this.options.logger?.call(undefined, 'Debug', 'Fetching environment permissions');

    const [rawPermissions, users] = await Promise.all([
      ForestHttpApi.getEnvironmentPermissions(this.options),
      ForestHttpApi.getUsers(this.options),
    ]);

    return generateActionsFromPermissions(rawPermissions, users);
  }
}
