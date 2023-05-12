import type { Chart, QueryChart } from './types';
import type { ChartHandlerInterface } from '../types';

import ContextVariablesInjector from '../utils/context-variables-injector';

export type ChartRequest<C extends Chart = Chart> = C;

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
    const { contextVariables, ...chartWithoutContext } = { ...chartRequest };

    return ContextVariablesInjector.injectContext(chartWithoutContext, contextVariables) as Chart;
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
