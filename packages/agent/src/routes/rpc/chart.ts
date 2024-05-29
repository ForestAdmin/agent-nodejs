import { CompositeId } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import QueryStringParser from '../../utils/query-string';
import CollectionRoute from '../collection-route';

export default class RpcChartRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.get(`/rpc/${this.collectionUrlSlug}/chart`, this.handleChart.bind(this));
  }

  public async handleChart(context: Context) {
    await this.services.authorization.assertCanBrowse(context, this.collection.name);

    const chart = context.query.chart as string;
    const recordId = context.query.recordId as CompositeId;

    const chartResult = await this.collection.renderChart(
      QueryStringParser.parseCaller(context),
      chart,
      recordId,
    );

    context.response.body = chartResult;
  }
}
