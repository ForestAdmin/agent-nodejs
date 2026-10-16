import type { TableModel } from '../src/types';

import { ConditionTreeFactory } from '@forestadmin/datasource-toolkit';

export const leaf = (field: string, operator: string, value?: unknown) =>
  ConditionTreeFactory.fromPlainObject({ field, operator, value } as never);

export const and = (...conditions: unknown[]) =>
  ConditionTreeFactory.fromPlainObject({ aggregator: 'And', conditions } as never);

export const or = (...conditions: unknown[]) =>
  ConditionTreeFactory.fromPlainObject({ aggregator: 'Or', conditions } as never);

export const plain = (field: string, operator: string, value?: unknown) => ({
  field,
  operator,
  value,
});

export function buildModel(overrides: Partial<TableModel> = {}): TableModel {
  return {
    name: 'orders',
    tableName: 'Orders',
    partitionKey: { name: 'customerId', type: 'S' },
    sortKey: { name: 'orderId', type: 'S' },
    indexes: [],
    schema: {
      customerId: { type: 'string' },
      orderId: { type: 'string' },
      status: { type: 'string', nullable: true },
      total: { type: 'number' },
      createdAt: { type: 'date' },
    },
    ...overrides,
  };
}

export function buildSimpleModel(overrides: Partial<TableModel> = {}): TableModel {
  return buildModel({
    name: 'users',
    tableName: 'Users',
    partitionKey: { name: 'id', type: 'S' },
    sortKey: undefined,
    schema: { id: { type: 'string' }, name: { type: 'string' }, age: { type: 'number' } },
    ...overrides,
  });
}
