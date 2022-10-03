import { Factory } from 'fishery';
import ActionPermissionService from '../../../../src/services/authorization/internal/action-permission';

export class ActionPermissionsFactory extends Factory<ActionPermissionService> {
  mockAllMethods() {
    return this.afterBuild(permissions => {
      permissions.can = jest.fn();
      permissions.canOneOf = jest.fn();
    });
  }
}

const actionPermissionsFactory = ActionPermissionsFactory.define(
  () =>
    new ActionPermissionService({
      isProduction: true,
      envSecret: '123',
      forestServerUrl: 'http://api',
      permissionsCacheDurationInSeconds: 15 * 60,
      logger: () => {},
    }),
);

export default actionPermissionsFactory;
