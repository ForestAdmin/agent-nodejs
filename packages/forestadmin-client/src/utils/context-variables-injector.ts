import type {
  PlainConditionTreeBranch,
  PlainConditionTreeLeaf,
} from '@forestadmin/datasource-toolkit';

import ContextVariables from './context-variables';

export default class ContextVariablesInjector {
  private static isPlainConditionTreeBranch(
    filter: PlainConditionTreeBranch | PlainConditionTreeLeaf,
  ): filter is PlainConditionTreeBranch {
    return 'aggregator' in filter;
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

  public static injectContextInFilter<
    PlainConditionTree extends PlainConditionTreeBranch | PlainConditionTreeLeaf | null,
  >(filter: PlainConditionTree, contextVariables: ContextVariables): PlainConditionTree {
    if (!filter) {
      return null;
    }

    if (ContextVariablesInjector.isPlainConditionTreeBranch(filter)) {
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
