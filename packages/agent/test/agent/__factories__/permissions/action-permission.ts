import { Factory } from 'fishery';
import ActionPermissionService from '../../../../src/agent/services/permissions/action-permission';

export class ActionPermissionsFactory extends Factory<ActionPermissionService> {
  mockAllMethods() {
    return this.afterBuild(permissions => {
      permissions.can = jest.fn();
      permissions.canOneOf = jest.fn();
    });
  }
}

export default ActionPermissionsFactory.define(
  () =>
    new ActionPermissionService({
      isProduction: true,
      envSecret: '123',
      forestServerUrl: 'http://api',
      permissionsCacheDurationInSeconds: 15 * 60,
    }),
);
