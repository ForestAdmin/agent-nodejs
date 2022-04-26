import { Caller } from '../interfaces/caller';
import { DataSource } from '../interfaces/collection';
import RelaxedDataSource from './relaxed-wrappers/datasource';

export default class AgentCustomizationContext {
  private realDataSource: DataSource;
  readonly caller: Caller;

  get dataSource(): RelaxedDataSource {
    return new RelaxedDataSource(this.realDataSource, this.caller);
  }

  constructor(dataSource: DataSource, caller: Caller) {
    this.realDataSource = dataSource;
    this.caller = caller;
  }
}
