import { Factory } from 'fishery';

import ActionPermissionService from '../../../src/permissions/action-permission';
import { forestAdminClientOptions, forestAdminServerInterface } from '../index';

export class ActionPermissionsFactory extends Factory<ActionPermissionService> {
  mockAllMethods() {
    return this.afterBuild(permissions => {
      permissions.isDevelopmentPermission = jest.fn();
      permissions.can = jest.fn();
      permissions.getCustomActionCondition = jest.fn();
      permissions.getAllCustomActionConditions = jest.fn();
      permissions.getRoleIdsAllowedToApproveWithoutConditions = jest.fn();
      permissions.invalidateCache = jest.fn();
    });
  }
}

const actionPermissionsFactory = ActionPermissionsFactory.define(
  () =>
    new ActionPermissionService(
      forestAdminClientOptions.build(),
      forestAdminServerInterface.build(),
    ),
);

export default actionPermissionsFactory;
