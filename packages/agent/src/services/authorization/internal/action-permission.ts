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

  public can(userId: string, actionName: string): Promise<boolean> {
    return this.hasPermissionOrRefetch({
      userId,
      actionName,
      allowRefetch: true,
    });
  }

  private async hasPermissionOrRefetch({
    userId,
    actionName,
    allowRefetch,
  }: {
    userId: string;
    actionName: string;
    allowRefetch: boolean;
  }): Promise<boolean> {
    const permissions = await this.getPermissions();
    const isAllowed = this.isAllowed({ permissions, actionName, userId });

    if (!isAllowed && allowRefetch) {
      this.permissionsPromise = undefined;
      this.permissionExpirationTimestamp = undefined;

      return this.hasPermissionOrRefetch({
        userId,
        actionName,
        allowRefetch: false,
      });
    }

    this.options.logger(
      'Debug',
      `User ${userId} is ${isAllowed ? '' : 'not '}allowed to perform ${actionName}`,
    );

    return isAllowed;
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
    return !!(
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
    this.options.logger('Debug', 'Fetching environment permissions');

    const [rawPermissions, users] = await Promise.all([
      ForestHttpApi.getEnvironmentPermissions(this.options),
      ForestHttpApi.getUsers(this.options),
    ]);

    return generateActionsFromPermissions(rawPermissions, users);
  }
}
