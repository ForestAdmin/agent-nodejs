import ContextVariablesInjector from '../utils/context-variables-injector';

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
import type { ChartHandlerInterface } from '../types';
import type { RequestContextVariables } from '../utils/context-variables';
import type ContextVariablesInstantiator from '../utils/context-variables-instantiator';

export type ChartRequest<C extends Chart = Chart> = C & {
  contextVariables?: RequestContextVariables;
};

export default class ChartHandlerService implements ChartHandlerInterface {
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
  }: {
    userId: string | number;
    renderingId: string | number;
    chartRequest: ChartRequest;
  }): Promise<Chart> {
    const contextVariables = await this.contextVariablesInstantiator.buildContextVariables({
      userId,
      renderingId,
      requestContextVariables: chartRequest.contextVariables,
    });

    const chart = { ...chartRequest };
    delete chart.contextVariables;

    if (ChartHandlerService.isFilterableChart(chart)) {
      chart.filter = ContextVariablesInjector.injectContextInFilter(chart.filter, contextVariables);
    }

    if (ChartHandlerService.isAggregatedChart(chart)) {
      chart.aggregator = ContextVariablesInjector.injectContextInValue(
        chart.aggregator,
        contextVariables,
      );
    }

    if (ChartHandlerService.isLineChart(chart)) {
      chart.timeRange = ContextVariablesInjector.injectContextInValue(
        chart.timeRange,
        contextVariables,
      );
    }

    if (ChartHandlerService.isObjectiveChart(chart)) {
      chart.objective = Number(
        ContextVariablesInjector.injectContextInValue(chart.objective, contextVariables),
      );
    }

    if (ChartHandlerService.isLeaderboardChart(chart)) {
      chart.limit = Number(
        ContextVariablesInjector.injectContextInValue(chart.limit, contextVariables),
      );
    }

    return chart;
  }
}
