import { Context } from 'koa';
import { DataSource } from '@forestadmin/datasource-toolkit';
import { v1 as uuidv1 } from 'uuid';
import Router from '@koa/router';
import path from 'path';

import { AgentOptionsWithDefaults, RouteType } from '../../types';
import { ForestAdminHttpDriverServices } from '../../services';
import BaseRoute from '../base-route';
import QueryStringParser from '../../utils/query-string';

export default class ApiChartRoute extends BaseRoute {
  readonly type = RouteType.PrivateRoute;

  private dataSource: DataSource;
  private chartName: string;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
    dataSource: DataSource,
    chartName: string,
  ) {
    super(services, options);

    this.dataSource = dataSource;
    this.chartName = chartName;
  }

  setupRoutes(router: Router): void {
    // Mount both GET and POST, respectively for smart and api charts.
    const suffix = `/_charts/${this.chartName}`;
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
          value: await this.dataSource.renderChart(
            QueryStringParser.parseCaller(context),
            this.chartName,
          ),
        },
      },
    };
  }

  private async handleSmartChart(context: Context) {
    // Smart charts need the data to be unformatted
    context.response.body = await this.dataSource.renderChart(
      QueryStringParser.parseCaller(context),
      this.chartName,
    );
  }
}
