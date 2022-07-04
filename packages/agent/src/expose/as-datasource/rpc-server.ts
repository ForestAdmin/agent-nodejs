/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Aggregation,
  ConditionTreeFactory,
  DataSource,
  Page,
  PaginatedFilter,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';

import { RpcServerOptions } from '../../types';

export default class ForestAdminRpcServer {
  private dataSource: DataSource;
  private options: RpcServerOptions;

  constructor(dataSource: DataSource, options: RpcServerOptions) {
    this.dataSource = dataSource;
    this.options = options;
  }

  async getRouter(): Promise<Router> {
    const router = new Router();
    router.use(bodyParser({ jsonLimit: '50mb' }));
    router.use(this.handleRun.bind(this));
    router.post('/', this.handleRun.bind(this));

    return router;
  }

  private async handleRun(ctx: Context): Promise<void> {
    const { body } = ctx.request;
    let result: unknown;

    if (body.collection) {
      const collection = this.dataSource.getCollection(body.collection);

      if (body.method === 'list') {
        result = await collection.list(
          body.params.caller,
          this.filterFromJson(body.params.filter),
          new Projection(...(body.params.projection ?? [])),
        );
      } else if (body.method === 'create') {
        result = await collection.create(body.params.caller, body.params.data);
      } else if (body.method === 'update') {
        result = await collection.update(
          body.params.caller,
          this.filterFromJson(body.params.filter),
          body.params.patch,
        );
      } else if (body.method === 'delete') {
        result = await collection.delete(
          body.params.caller,
          this.filterFromJson(body.params.filter),
        );
      } else if (body.method === 'aggregate') {
        result = await collection.aggregate(
          body.params.caller,
          this.filterFromJson(body.params.filter),
          new Aggregation(body.params.aggregation),
          body.params.limit,
        );
      } else {
        throw new Error('Unsupported');
      }
    } else if (body.method === 'renderChart') {
      result = await this.dataSource.renderChart(body.params.caller, body.params.name);
    } else if (body.method === 'schema') {
      result = this.dataSource.schema;
    } else if (body.method === 'handshake') {
      const dataSourceSchema = this.dataSource.schema;
      const collectionSchemas = this.dataSource.collections.reduce(
        (memo, collection) => ({ ...memo, [collection.name]: collection.schema }),
        {},
      );

      result = {
        dataSourceSchema,
        collectionSchemas: JSON.parse(
          JSON.stringify(collectionSchemas, (key, value) => {
            return key === 'filterOperators' ? [...value.values()] : value;
          }),
        ),
      };
    } else {
      throw new Error('Unsupported');
    }

    ctx.response.body = result;
  }

  private filterFromJson(json: any): PaginatedFilter {
    const conditionTree = ConditionTreeFactory.fromPlainObject(json?.conditionTree ?? null);
    const page = new Page(json?.page?.skip, json?.page?.limit);
    const sort = new Sort(...(json?.sort ?? []));
    const { search, searchExtended, segment } = json;

    return new PaginatedFilter({
      conditionTree,
      page,
      sort,
      search,
      searchExtended,
      segment,
    });
  }
}
