import { Factory } from 'fishery';
import ActionPermissionService from '../../../src/permissions/action-permission';

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
      envSecret: '123',
      forestServerUrl: 'http://api',
      permissionsCacheDurationInSeconds: 15 * 60,
      logger: () => {},
    }),
);

export default actionPermissionsFactory;
