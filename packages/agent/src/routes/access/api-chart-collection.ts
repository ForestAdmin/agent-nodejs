import { Chart, DataSource } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';
import path from 'path';
import { v1 as uuidv1 } from 'uuid';

import { ForestAdminHttpDriverServices } from '../../services';
import { AgentOptionsWithDefaults } from '../../types';
import IdUtils from '../../utils/id';
import CallerParser from '../../utils/query-parser/caller';
import CollectionRoute from '../collection-route';

export default class CollectionApiChartRoute extends CollectionRoute {
  private chartName: string;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
    dataSource: DataSource,
    collectionName: string,
    chartName: string,
  ) {
    super(services, options, dataSource, collectionName);
    this.chartName = chartName;
  }

  setupRoutes(router: Router): void {
    // Mount both GET and POST, respectively for smart and api charts.
    const suffix = `/_charts/${this.collection.name}/${this.chartName}`;
    router.get(suffix, this.handleSmartChart.bind(this));
    router.post(suffix, this.handleApiChart.bind(this));

    // Log the route to help the customer fill the url in the frontend
    if (!this.options.isProduction) {
      const url = path.posix.join('/', this.options.prefix, 'forest', suffix);
      this.options.logger('Info', `Chart '${this.chartName}' was mounted at '${url}'`);
    }
  }

  private async handleApiChart(context: Context) {
    // Api Charts need the data to be formatted in JSON-API
    context.response.body = {
      data: {
        id: uuidv1(),
        type: 'stats',
        attributes: {
          value: await this.renderChart(context),
        },
      },
    };
  }

  private async handleSmartChart(context: Context) {
    // Smart charts need the data to be unformatted
    context.response.body = await this.renderChart(context);
  }

  private async renderChart(context: Context): Promise<Chart> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = context.request.body as any;

    return this.collection.renderChart(
      CallerParser.fromCtx(context),
      this.chartName,
      IdUtils.unpackId(
        this.collection.schema,
        String(body?.record_id ?? context.request.query?.record_id),
      ),
    );
  }
}
