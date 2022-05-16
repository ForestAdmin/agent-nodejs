import { Caller } from '../interfaces/caller';
import { DataSource } from '../interfaces/collection';
import { TSchema } from '../interfaces/templates';
import RelaxedDataSource from './relaxed-wrappers/datasource';

export default class AgentCustomizationContext<S extends TSchema = TSchema> {
  private realDataSource: DataSource;
  readonly caller: Caller;

  get dataSource(): RelaxedDataSource<S> {
    return new RelaxedDataSource<S>(this.realDataSource, this.caller);
  }

  constructor(dataSource: DataSource, caller: Caller) {
    this.realDataSource = dataSource;
    this.caller = caller;
  }
}
