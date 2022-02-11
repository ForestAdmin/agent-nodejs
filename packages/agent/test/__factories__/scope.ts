import { ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import { Factory } from 'fishery';
import Scope from '../../src/services/scope';

export class ScopeFactory extends Factory<Scope> {
  mockAllMethods() {
    return this.afterBuild(scope => {
      scope.getConditionTree = jest.fn().mockResolvedValue(ConditionTreeFactory.MatchAll);
      scope.invalidateCache = jest.fn();
    });
  }
}

export default ScopeFactory.define(
  () =>
    new Scope({
      envSecret: '123',
      forestServerUrl: 'http://api',
      scopesCacheDurationInSeconds: 15 * 60,
    }),
);
