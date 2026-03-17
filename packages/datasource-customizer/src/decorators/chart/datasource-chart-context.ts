import type { TSchema } from '../../templates';
import type { Caller, DataSource } from '@forestadmin/datasource-toolkit';

import AgentCustomizationContext from '../../context/agent-context';

export default class DataSourceChartContext<
  S extends TSchema = TSchema,
> extends AgentCustomizationContext<S> {
  private _parameters: Record<string, string>;

  get parameters(): Record<string, string> {
    return Object.freeze({ ...this._parameters });
  }

  constructor(dataSource: DataSource, caller: Caller, parameters?: Record<string, string>) {
    super(dataSource, caller);
    this._parameters = parameters ?? {};
  }
}
