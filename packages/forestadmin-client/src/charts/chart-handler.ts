import type { Collection } from '@forestadmin/datasource-toolkit';

import {
  AggregatedChart,
  ApiRouteChart,
  Chart,
  ChartType,
  FilterableChart,
  LeaderboardChart,
  LineChart,
  ObjectiveChart,
} from './types';
import { RequestContextVariables } from '../utils/context-variables';
import ContextVariablesInjector from '../utils/context-variables-injector';
import ContextVariablesInstantiator from '../utils/context-variables-instantiator';

export type ChartRequest<C extends Chart = Chart> = C & {
  contextVariables: RequestContextVariables;
};

export default class ChartHandler {
  constructor(private readonly contextVariablesInstantiator: ContextVariablesInstantiator) {}

  public static isAPIRouteChart(chart: Chart): chart is ApiRouteChart {
    return 'apiRoute' in chart;
  }

  public static isLineChart(chart: Chart): chart is LineChart {
    return chart.type === ChartType.Line;
  }

  public static isObjectiveChart(chart: Chart): chart is ObjectiveChart {
    return chart.type === ChartType.Objective;
  }

  public static isLeaderboardChart(chart: Chart): chart is LeaderboardChart {
    return chart.type === ChartType.Leaderboard;
  }

  public static isFilterableChart(chart: Chart): chart is FilterableChart & Chart {
    return 'filter' in chart;
  }

  public static isAggregatedChart(chart: Chart): chart is AggregatedChart & Chart {
    return 'aggregator' in chart;
  }

  public async getChart({
    userId,
    renderingId,
    chartRequest,
    collection,
  }: {
    userId: string | number;
    renderingId: string | number;
    chartRequest: ChartRequest;
    collection: Collection;
  }): Promise<Chart> {
    const contextVariables = await this.contextVariablesInstantiator.buildContextVariables({
      userId,
      renderingId,
      requestContextVariables: chartRequest.contextVariables,
    });

    const chart = { ...chartRequest };
    delete chart.contextVariables;

    if (ChartHandler.isFilterableChart(chart)) {
      chart.filter = ContextVariablesInjector.injectContextInFilter(
        chart.filter,
        contextVariables,
        collection,
      );
    }

    if (ChartHandler.isAggregatedChart(chart)) {
      chart.aggregator = ContextVariablesInjector.injectContextInValue(
        chart.aggregator,
        contextVariables,
        'String',
      );
    }

    if (ChartHandler.isLineChart(chart)) {
      chart.timeRange = ContextVariablesInjector.injectContextInValue(
        chart.timeRange,
        contextVariables,
        'String',
      );
    }

    if (ChartHandler.isObjectiveChart(chart)) {
      chart.objective = ContextVariablesInjector.injectContextInValue(
        chart.objective,
        contextVariables,
        'Number',
      );
    }

    if (ChartHandler.isLeaderboardChart(chart)) {
      chart.limit = ContextVariablesInjector.injectContextInValue(
        chart.limit,
        contextVariables,
        'Number',
      );
    }

    return chart;
  }
}
