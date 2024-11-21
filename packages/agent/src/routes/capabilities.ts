import { DataSource } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import BaseRoute from './base-route';
import { ForestAdminHttpDriverServices } from '../services';
import { AgentOptionsWithDefaults, HttpCode, RouteType } from '../types';

export default class Capabilities extends BaseRoute {
  readonly type = RouteType.PrivateRoute;
  protected readonly dataSource: DataSource;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
    dataSource: DataSource,
  ) {
    super(services, options);
    this.dataSource = dataSource;
  }

  setupRoutes(router: Router): void {
    router.post(`/_internal/capabilities`, this.fetchCapabilities.bind(this));
  }

  private async fetchCapabilities(context: Context) {
    const collections = this.dataSource.collections.filter(collection =>
      (context.request.body as { collectionNames: string[] }).collectionNames?.includes(
        collection.name,
      ),
    );

    context.response.body = {
      nativeQueryConnections: Object.keys(this.dataSource.nativeQueryConnections).map(
        connectionName => ({ name: connectionName }),
      ),
      collections:
        collections?.map(collection => ({
          name: collection.name,
          fields: Object.entries(collection.schema.fields)
            .map(([fieldName, field]) => {
              return field.type === 'Column'
                ? {
                    name: fieldName,
                    type: field.columnType,
                    operators: [...field.filterOperators].map(this.pascalCaseToSnakeCase),
                  }
                : null;
            })
            .filter(Boolean),
        })) ?? [],
    };
    context.response.status = HttpCode.Ok;
  }

  private pascalCaseToSnakeCase(str: string): string {
    return str
      .split(/\.?(?=[A-Z])/)
      .join('_')
      .toLowerCase();
  }
}
