import type { TSchema } from '../../templates';
import type { Caller, DataSource } from '@forestadmin/datasource-toolkit';

import AgentCustomizationContext from '../../context/agent-context';

export default class DataSourceChartContext<
  S extends TSchema = TSchema,
> extends AgentCustomizationContext<S> {
  private _contextVariables: Record<string, string>;

  get contextVariables(): Record<string, string> {
    return Object.freeze({ ...this._contextVariables });
  }

  constructor(dataSource: DataSource, caller: Caller, contextVariables?: Record<string, string>) {
    super(dataSource, caller);
    this._contextVariables = contextVariables ?? {};
  }
}
