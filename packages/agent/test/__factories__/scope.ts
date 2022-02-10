import { ConditionTree, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import { Factory } from 'fishery';
import Scope from '../../src/services/scope';

class DummyScope extends Scope {
  constructor() {
    super({ envSecret: '', forestServerUrl: '', scopesCacheDurationInSeconds: 0 });
  }

  override invalidateCache(): void {}

  override async getConditionTree(): Promise<ConditionTree> {
    return ConditionTreeFactory.MatchAll;
  }
}

export default Factory.define<Scope>(() => new DummyScope());
