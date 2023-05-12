import { Factory } from 'fishery';

import UserPermissionService from '../../../src/permissions/user-permission';
import { forestAdminClientOptions, forestAdminServerInterface } from '../index';

export class UserPermissionsFactory extends Factory<UserPermissionService> {
  mockAllMethods() {
    return this.afterBuild(permissions => {
      permissions.getUserInfo = jest.fn();
      permissions.invalidateCache = jest.fn();
    });
  }
}

const userPermissionsFactory = UserPermissionsFactory.define(
  () =>
    new UserPermissionService(forestAdminClientOptions.build(), forestAdminServerInterface.build()),
);

export default userPermissionsFactory;
