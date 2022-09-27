import { Factory } from 'fishery';
import UserPermissionService from '../../../../src/services/authorization/internal/user-permission';

export class UserPermissionsFactory extends Factory<UserPermissionService> {
  mockAllMethods() {
    return this.afterBuild(permissions => {
      permissions.getUserInfo = jest.fn();
    });
  }
}

const userPermissionsFactory = UserPermissionsFactory.define(
  () =>
    new UserPermissionService({
      isProduction: true,
      envSecret: '123',
      forestServerUrl: 'http://api',
      permissionsCacheDurationInSeconds: 15 * 60,
    }),
);

export default userPermissionsFactory;
