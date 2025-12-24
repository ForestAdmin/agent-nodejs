import type { Caller, PaginatedFilter } from '@forestadmin/datasource-toolkit';
import type { ContextVariablesInstantiatorInterface } from '@forestadmin/forestadmin-client';
import type { Context } from 'koa';

import { ContextVariablesInjector } from '@forestadmin/forestadmin-client';

export default class SegmentQueryHandler {
  private readonly contextVariablesInstantiator: ContextVariablesInstantiatorInterface;

  constructor(contextVariablesInstantiator: ContextVariablesInstantiatorInterface) {
    this.contextVariablesInstantiator = contextVariablesInstantiator;
  }

  public async handleLiveQuerySegmentFilter(context: Context, paginatedFilter: PaginatedFilter) {
    if (paginatedFilter.liveQuerySegment) {
      const { renderingId, id: userId } = <Caller>context.state.user;
      const contextVariables = await this.contextVariablesInstantiator.buildContextVariables({
        userId,
        renderingId,
      });
      const contextVariablesUsed: Record<string, unknown> = {};

      const replaceContextVariable = (contextVariableName: string) => {
        const contextVariableRenamed = contextVariableName.replace(/\./g, '_');
        contextVariablesUsed[contextVariableRenamed] =
          contextVariables.getValue(contextVariableName);

        return `$${contextVariableRenamed}`;
      };

      const replacedQuery = ContextVariablesInjector.injectContextInValueCustom(
        paginatedFilter.liveQuerySegment.query,
        replaceContextVariable,
      );

      return paginatedFilter.override({
        liveQuerySegment: {
          query: replacedQuery,
          contextVariables: contextVariablesUsed,
          connectionName: paginatedFilter.liveQuerySegment.connectionName,
        },
      });
    }

    return paginatedFilter;
  }
}
