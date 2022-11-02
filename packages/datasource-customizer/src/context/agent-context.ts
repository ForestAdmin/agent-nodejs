import { Caller, DataSource } from '@forestadmin/datasource-toolkit';

import { TSchema } from '../templates';
import RelaxedDataSource from './relaxed-wrappers/datasource';

export default class AgentCustomizationContext<S extends TSchema = TSchema> {
  private realDataSource: DataSource;
  private _caller: Caller;

  get dataSource(): RelaxedDataSource<S> {
    return new RelaxedDataSource<S>(this.realDataSource, this._caller);
  }

  constructor(dataSource: DataSource, caller: Caller) {
    this.realDataSource = dataSource;
    this._caller = caller;
  }

  get caller() {
    return Object.freeze(this._caller);
  }
}
