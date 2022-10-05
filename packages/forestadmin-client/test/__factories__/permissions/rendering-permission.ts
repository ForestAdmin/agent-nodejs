import { Factory } from 'fishery';
import RenderingPermissionService from '../../../src/permissions/rendering-permission';
import userPermissionsFactory from './user-permission';

export class RenderingPermissionsFactory extends Factory<RenderingPermissionService> {
  mockAllMethods() {
    return this.afterBuild(permissions => {
      permissions.getScope = jest.fn();
      permissions.canRetrieveChart = jest.fn();
      permissions.invalidateCache = jest.fn();
    });
  }
}

const renderingPermissionsFactory = RenderingPermissionsFactory.define(
  () =>
    new RenderingPermissionService(
      {
        envSecret: '123',
        forestServerUrl: 'http://api',
        permissionsCacheDurationInSeconds: 15 * 60,
        logger: () => {},
      },
      userPermissionsFactory.build(),
    ),
);

export default renderingPermissionsFactory;
