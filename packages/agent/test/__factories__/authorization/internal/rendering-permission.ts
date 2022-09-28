import { Factory } from 'fishery';
import RenderingPermissionService from '../../../../src/services/authorization/internal/rendering-permission';
import userPermissionsFactory from './user-permission';

export class RenderingPermissionsFactory extends Factory<RenderingPermissionService> {
  mockAllMethods() {
    return this.afterBuild(permissions => {
      permissions.getScope = jest.fn();
    });
  }
}

const renderingPermissionsFactory = RenderingPermissionsFactory.define(
  () =>
    new RenderingPermissionService(
      {
        isProduction: true,
        envSecret: '123',
        forestServerUrl: 'http://api',
        permissionsCacheDurationInSeconds: 15 * 60,
      },
      userPermissionsFactory.build(),
    ),
);

export default renderingPermissionsFactory;
