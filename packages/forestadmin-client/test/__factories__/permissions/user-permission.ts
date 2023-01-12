import { Factory } from 'fishery';

import UserPermissionService from '../../../src/permissions/user-permission';
import { forestAdminServerInterface } from '../index';

export class UserPermissionsFactory extends Factory<UserPermissionService> {
  mockAllMethods() {
    return this.afterBuild(permissions => {
      permissions.getUserInfo = jest.fn();
    });
  }
}

const userPermissionsFactory = UserPermissionsFactory.define(
  () =>
    new UserPermissionService(
      {
        envSecret: '123',
        forestServerUrl: 'http://api',
        permissionsCacheDurationInSeconds: 15 * 60,
        logger: () => {},
      },
      forestAdminServerInterface.build(),
    ),
);

export default userPermissionsFactory;
