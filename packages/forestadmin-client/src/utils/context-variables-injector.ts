import {
  Collection,
  CollectionUtils,
  ColumnSchema,
  ColumnType,
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

  private static getExpectedTypeForCondition(
    filter: PlainConditionTreeLeaf,
    collection: Collection,
  ): ColumnType {
    if (
      [
        'ShorterThan',
        'LongerThan',
        'AfterXHoursAgo',
        'BeforeXHoursAgo',
        'PreviousXDays',
        'PreviousXDaysToDate',
      ].includes(filter.operator)
    ) {
      return 'Number';
    }

    const fieldSchema = CollectionUtils.getFieldSchema(collection, filter.field) as ColumnSchema;

    return fieldSchema.columnType;
  }

  private static castToBoolean(value: unknown): boolean {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return !!value;
  }

  private static castToType(value: unknown, expectedType: ColumnType): unknown {
    if (value === null || value === undefined) return value;

    switch (expectedType) {
      case 'String':
      case 'Dateonly':
        return `${value as string | number}`;
      case 'Number':
        return Number(value);
      case 'Boolean':
        return ContextVariablesInjector.castToBoolean(value);
      case 'Date':
        return new Date(value as string | Date);
      default:
        return value;
    }
  }

  public static injectContextInValue<ValueType>(
    value: ValueType,
    contextVariables: ContextVariables,
    expectedType: ColumnType,
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

    return ContextVariablesInjector.castToType(
      valueWithContextVariablesInjected,
      expectedType,
    ) as ValueType;
  }

  public static injectContextInFilter<
    PlainConditionTree extends PlainConditionTreeBranch | PlainConditionTreeLeaf,
  >(
    filter: PlainConditionTree,
    contextVariables: ContextVariables,
    collection: Collection,
  ): PlainConditionTree {
    if (!filter) {
      return null;
    }

    if (ContextVariablesInjector.isPlainConditionTreeBranch(filter)) {
      return {
        ...filter,
        conditions: filter.conditions.map(condition => {
          return this.injectContextInFilter(condition, contextVariables, collection);
        }),
      };
    }

    return {
      ...filter,
      value: this.injectContextInValue(
        filter.value,
        contextVariables,
        ContextVariablesInjector.getExpectedTypeForCondition(filter, collection),
      ),
    };
  }
}
