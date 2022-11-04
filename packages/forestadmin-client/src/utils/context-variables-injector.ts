import { GenericRawTreeBranch, RawTree, RawTreeLeaf } from '../permissions/types';
import ContextVariables from './context-variables';

export default class ContextVariablesInjector {
  private static isTreeBranch(filter: RawTree): filter is GenericRawTreeBranch<RawTreeLeaf> {
    return 'aggregator' in filter;
  }

  public static injectContextInValueCustom<ValueType>(
    value: ValueType,
    replaceFunction: (contextVariableName: string) => string,
  ) {
    if (typeof value !== 'string') {
      return value;
    }

    let valueWithContextVariablesInjected: string = value;
    const regex = /{{([^}]+)}}/g;
    let match = regex.exec(value);
    const encounteredVariables = [];

    while (match) {
      const contextVariableKey = match[1];

      if (!encounteredVariables.includes(contextVariableKey)) {
        valueWithContextVariablesInjected = valueWithContextVariablesInjected.replace(
          new RegExp(`{{${contextVariableKey}}}`, 'g'),
          replaceFunction(contextVariableKey),
        );
      }

      encounteredVariables.push(contextVariableKey);
      match = regex.exec(value);
    }

    return valueWithContextVariablesInjected as unknown as ValueType;
  }

  public static injectContextInValue<ValueType>(
    value: ValueType,
    contextVariables: ContextVariables,
  ): ValueType {
    return this.injectContextInValueCustom(value, contextVariableKey =>
      String(contextVariables.getValue(contextVariableKey)),
    );
  }

  public static injectContextInFilter(
    filter: RawTree,
    contextVariables: ContextVariables,
  ): RawTree {
    if (!filter) {
      return null;
    }

    if (ContextVariablesInjector.isTreeBranch(filter)) {
      return {
        ...filter,
        conditions: filter.conditions.map(condition => {
          return this.injectContextInFilter(condition, contextVariables);
        }),
      };
    }

    return {
      ...filter,
      value: this.injectContextInValue(filter.value, contextVariables),
    };
  }
}
