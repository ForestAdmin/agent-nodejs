import { Caller, DataSource, UnprocessableError } from '@forestadmin/datasource-toolkit';
import { ChartType, QueryChart } from '@forestadmin/forestadmin-client';
import Router from '@koa/router';
import { Context } from 'koa';
import { v1 as uuidv1 } from 'uuid';

import { ForestAdminHttpDriverServices } from '../../services';
import { AgentOptionsWithDefaults, RouteType } from '../../types';
import BaseRoute from '../base-route';

function isQueryChartRequest(body): body is QueryChart {
  return (
    Boolean(body.query) &&
    Object.values(ChartType).includes(body.type) &&
    body.type !== ChartType.Smart
  );
}

export default class DataSourceNativeQueryRoute extends BaseRoute {
  readonly type = RouteType.PrivateRoute;
  private dataSource: DataSource;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
    dataSource: DataSource,
  ) {
    super(services, options);
    this.dataSource = dataSource;
  }

  setupRoutes(router: Router): void {
    router.post(`/_internal/native_query`, this.handleNativeQuery.bind(this));
  }

  private async handleNativeQuery(context: Context) {
    if (!isQueryChartRequest(context.request.body)) {
      throw new UnprocessableError('Native query endpoint only supports Query Chart Requests');
    }

    const chartRequest = context.request.body;

    if (!chartRequest.connectionName) {
      throw new UnprocessableError('Missing native query connection attribute');
    }

    if (!this.dataSource.nativeQueryConnections[chartRequest.connectionName]) {
      throw new UnprocessableError(
        `Native query connection '${chartRequest.connectionName}' is unknown`,
      );
    }

    await this.services.authorization.assertCanExecuteChart(context);

    context.response.body = {
      data: {
        id: uuidv1(),
        type: 'stats',
        attributes: { value: await this.makeChart(context, chartRequest) },
      },
    };
  }

  private async makeChart(context: Context, chartRequest: QueryChart) {
    const { renderingId, id: userId } = <Caller>context.state.user;

    const { query, contextVariables } = await this.services.chartHandler.getQueryForChart({
      userId,
      renderingId,
      chartRequest,
    });

    const result = (await this.dataSource.executeNativeQuery(
      chartRequest.connectionName,
      query,
      contextVariables,
    )) as Record<string, unknown>[];

    let body;

    switch (chartRequest.type) {
      case ChartType.Value:
        if (result.length) {
          const resultLine = result[0];

          if (resultLine.value === undefined) {
            this.getErrorQueryColumnsName(resultLine, ['value']);
          } else {
            body = {
              countCurrent: resultLine.value,
              countPrevious: resultLine.previous,
            };
          }
        }

        break;
      case ChartType.Pie:
      case ChartType.Leaderboard:
        if (result.length) {
          result.forEach(resultLine => {
            if (resultLine.value === undefined || resultLine.key === undefined) {
              this.getErrorQueryColumnsName(resultLine, ['key', 'value']);
            }
          });
        }

        break;
      case ChartType.Line:
        if (result.length) {
          result.forEach(resultLine => {
            if (resultLine.value === undefined || resultLine.key === undefined) {
              this.getErrorQueryColumnsName(resultLine, ['key', 'value']);
            }
          });
        }

        body = result.map(resultLine => ({
          label: resultLine.key,
          values: {
            value: resultLine.value,
          },
        }));
        break;
      case ChartType.Objective:
        if (result.length) {
          const resultLine = result[0];

          if (resultLine.value === undefined || resultLine.objective === undefined) {
            this.getErrorQueryColumnsName(resultLine, ['value', 'objective']);
          } else {
            body = {
              objective: resultLine.objective,
              value: resultLine.value,
            };
          }
        }

        break;
      default:
        throw new Error('Unknown Chart type');
    }

    return body || result;
  }

  private getErrorQueryColumnsName(result: Record<string, unknown>, keyNames: string[]) {
    const message = `The result columns must be named ${keyNames.join(
      ', ',
    )} instead of '${Object.keys(result).join("', '")}'.`;

    throw new UnprocessableError(message);
  }
}
