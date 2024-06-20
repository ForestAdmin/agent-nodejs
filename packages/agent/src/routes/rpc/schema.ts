import { DataSource } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import { ForestAdminHttpDriverServices } from '../../services';
import { AgentOptionsWithDefaults, RouteType } from '../../types';
import BaseRoute from '../base-route';

export default class RpcSchemaRoute extends BaseRoute {
  type = RouteType.PrivateRoute;

  protected readonly dataSource: DataSource;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
    dataSource: DataSource,
  ) {
    super(services, options);

    this.dataSource = dataSource;
  }

  override setupRoutes(router: Router): void {
    router.get('/rpc-schema', this.handleRpc.bind(this));
  }

  handleRpc(context: Context) {
    context.response.body = {
      schema: {
        collections: this.dataSource.collections.reduce((collections, collection) => {
          const fields = Object.entries(collection.schema.fields).reduce(
            (fileds, [name, schema]) => {
              fileds[name] = {
                ...schema,
                filterOperators: Array.from(schema.type === 'Column' ? schema.filterOperators : []),
              };

              return fileds;
            },
            {},
          );

          collections[collection.name] = { ...collection.schema, fields };

          return collections;
        }, {}),
      },
    };
  }
}
