import { ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import { Factory } from 'fishery';
import PermissionService from '../../src/services/permissions';

export class ScopeFactory extends Factory<PermissionService> {
  mockAllMethods() {
    return this.afterBuild(permissions => {
      permissions.getScope = jest.fn().mockResolvedValue(ConditionTreeFactory.MatchAll);
      permissions.invalidateCache = jest.fn();
      permissions.can = jest.fn().mockResolvedValue(undefined);
    });
  }
}

export default ScopeFactory.define(
  () =>
    new PermissionService({
      isProduction: true,
      envSecret: '123',
      forestServerUrl: 'http://api',
      permissionsCacheDurationInSeconds: 15 * 60,
    }),
);
