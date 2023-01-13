import type { Chart, QueryChart } from './types';
import type { ChartHandlerInterface } from '../types';
import type { RequestContextVariables } from '../utils/context-variables';
import type ContextVariablesInstantiator from '../utils/context-variables-instantiator';

import ChartDetector from '../utils/chart-detector';
import ContextVariablesInjector from '../utils/context-variables-injector';

export type ChartRequest<C extends Chart = Chart> = C & {
  contextVariables?: RequestContextVariables;
};

export default class ChartHandlerService implements ChartHandlerInterface {
  constructor(private readonly contextVariablesInstantiator: ContextVariablesInstantiator) {}

  public async getChartWithContextInjected({
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

    if (ChartDetector.isFilterableChart(chart)) {
      chart.filter = ContextVariablesInjector.injectContextInFilter(chart.filter, contextVariables);
    }

    if (ChartDetector.isAggregatedChart(chart)) {
      chart.aggregator = ContextVariablesInjector.injectContextInValue(
        chart.aggregator,
        contextVariables,
      );
    }

    if (ChartDetector.isLineChart(chart)) {
      chart.timeRange = ContextVariablesInjector.injectContextInValue(
        chart.timeRange,
        contextVariables,
      );
    }

    if (ChartDetector.isObjectiveChart(chart)) {
      chart.objective = Number(
        ContextVariablesInjector.injectContextInValue(chart.objective, contextVariables),
      );
    }

    if (ChartDetector.isLeaderboardChart(chart)) {
      chart.limit = Number(
        ContextVariablesInjector.injectContextInValue(chart.limit, contextVariables),
      );
    }

    return chart;
  }

  public async getQueryForChart({
    userId,
    renderingId,
    chartRequest,
  }: {
    userId: string | number;
    renderingId: string | number;
    chartRequest: ChartRequest<QueryChart>;
  }) {
    const contextVariables = await this.contextVariablesInstantiator.buildContextVariables({
      userId,
      renderingId,
      requestContextVariables: chartRequest.contextVariables,
    });
    const contextVariablesUsed: Record<string, unknown> = {};

    const replaceContextVariable = (contextVariableName: string) => {
      const contextVariableRenamed = contextVariableName.replace(/\./g, '_');
      contextVariablesUsed[contextVariableRenamed] = contextVariables.getValue(contextVariableName);

      return `$${contextVariableRenamed}`;
    };

    const query = ContextVariablesInjector.injectContextInValueCustom(
      chartRequest.query,
      replaceContextVariable,
    );

    return {
      query,
      contextVariables: contextVariablesUsed,
    };
  }
}
