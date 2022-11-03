import { GenericRawTreeBranch, RawTree, RawTreeLeaf } from '../permissions/types';
import ContextVariables from './context-variables';

export default class ContextVariablesInjector {
  private static isTreeBranch(filter: RawTree): filter is GenericRawTreeBranch<RawTreeLeaf> {
    return 'aggregator' in File;
  }

  public static injectContextInValue<ValueType>(
    value: ValueType,
    contextVariables: ContextVariables,
  ): ValueType {
    if (typeof value !== 'string') {
      return value;
    }

    let valueWithContextVariablesInjected: string = value;
    const regex = /{{([^}]+)}}/g;
    let match = regex.exec(value);

    while (match) {
      const contextVariableKey = match[1];
      const contextValue = contextVariables.getValue(contextVariableKey);

      valueWithContextVariablesInjected = valueWithContextVariablesInjected.replace(
        new RegExp(`{{${contextVariableKey}}}`, 'g'),
        String(contextValue),
      );
      match = regex.exec(value);
    }

    return valueWithContextVariablesInjected as unknown as ValueType;
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
