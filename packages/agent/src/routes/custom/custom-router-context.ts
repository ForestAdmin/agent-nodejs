import type { ForestAdminHttpDriverServices } from '../../services';
import type { AgentOptionsWithDefaults, CustomRouterContext } from '../../types';
import type { DataSource, Logger } from '@forestadmin/datasource-toolkit';

export default class CustomRouterContextImpl implements CustomRouterContext {
  readonly dataSource: DataSource;
  readonly services: ForestAdminHttpDriverServices;
  readonly options: AgentOptionsWithDefaults;

  constructor(
    dataSource: DataSource,
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
  ) {
    this.dataSource = dataSource;
    this.services = services;
    this.options = options;
  }

  get logger(): Logger {
    return this.options.logger;
  }
}
