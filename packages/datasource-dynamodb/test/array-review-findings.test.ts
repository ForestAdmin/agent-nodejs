import type { DataSource } from '@forestadmin/datasource-toolkit';

import { Filter, PaginatedFilter, Projection } from '@forestadmin/datasource-toolkit';

import { buildCollection } from './collection-helpers';
import { fakeClient } from './fake-client';
import { buildModel } from './helpers';
import { createDynamoDBDataSource } from '../src';
import ArrayCollection from '../src/array-collection';

const caller = { timezone: 'UTC' } as never;

function build(handlers: Record<string, unknown>, model = buildModel()) {
  const parent = buildCollection(
    {
      ...model,
      schema: {
        customerId: { type: 'string' },
        orderId: { type: 'string' },
        lines: { type: 'array' },
      },
    },
    handlers as never,
    { scanConcurrency: 1, chartCacheTtlMs: 60000 },
  );
  const collection = new ArrayCollection({} as DataSource, parent.collection, {
    name: 'order_lines',
    arrayField: 'lines',
    itemSchema: { sku: { type: 'string' }, qty: { type: 'number' }, index: { type: 'number' } },
  });

  return { collection, client: parent.client };
}

const order = (lines: unknown[]) => ({ customerId: 'c1', orderId: 'o1', lines });

describe('ArrayCollection review findings', () => {
  it('keeps the identity of a record when the element has an attribute of the same name', async () => {
    const { collection } = build({
      Scan: () => ({ Items: [order([{ sku: 'A', index: 99, customerId: 'other' }])] }),
    });

    const [record] = await collection.list(
      caller,
      new PaginatedFilter({}),
      new Projection('customerId', 'index', 'sku'),
    );

    expect(record).toEqual({ customerId: 'c1', index: 0, sku: 'A' });
  });

  it('splits the removal of many elements into expressions DynamoDB accepts', async () => {
    const lines = Array.from({ length: 1000 }, (_, i) => ({ sku: `S${i}` }));
    const { collection, client } = build({
      Scan: () => ({ Items: [order(lines)] }),
      Update: () => ({}),
    });

    await collection.delete(caller, new Filter({}));

    const expressions = client.calls('Update').map(call => call.UpdateExpression as string);
    const removed = expressions.flatMap(e => [...e.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1])));

    expect(expressions.length).toBeGreaterThan(1);
    expect(Math.max(...expressions.map(e => e.length))).toBeLessThan(4096);
    expect(removed).toEqual(Array.from({ length: 1000 }, (_, i) => 999 - i));
  });

  it('splits the update of many elements too', async () => {
    const lines = Array.from({ length: 1000 }, (_, i) => ({ sku: `S${i}` }));
    const { collection, client } = build({
      Scan: () => ({ Items: [order(lines)] }),
      Update: () => ({}),
    });

    await collection.update(caller, new Filter({}), { qty: 1 });

    const lengths = client.calls('Update').map(call => (call.UpdateExpression as string).length);

    expect(lengths.length).toBeGreaterThan(1);
    expect(Math.max(...lengths)).toBeLessThan(4096);
  });

  it('sets an attribute under a map the element does not have yet, by rewriting the item', async () => {
    const { collection, client } = build({
      Scan: () => ({ Items: [order([{ sku: 'A' }])] }),
      Update: () => {
        throw Object.assign(
          new Error('The document path provided in the update expression is invalid for update'),
          { name: 'ValidationException' },
        );
      },
      Get: () => ({ Item: order([{ sku: 'A' }]) }),
      Put: () => ({}),
    });

    await collection.update(caller, new Filter({}), { 'details->note': 'hi' });

    expect(client.calls('Put')[0].Item).toEqual(order([{ sku: 'A', details: { note: 'hi' } }]));
  });

  it('only touches items of the entity the parent stands for', async () => {
    const { collection, client } = build(
      {
        Scan: () => ({ Items: [order([{ sku: 'A' }])] }),
        Update: () => ({}),
      },
      buildModel({ entity: { attribute: 'entityType', value: 'ORDER' } }),
    );

    await collection.update(caller, new Filter({}), { qty: 2 });
    await collection
      .create(caller, [{ customerId: 'c1', orderId: 'o1', sku: 'B' }])
      .catch(() => {});

    for (const call of client.calls('Update')) {
      expect(call.ConditionExpression).toMatch(/^attribute_exists\(#k0\) AND .*#n\d = :v\d$/);
      expect(Object.values(call.ExpressionAttributeValues)).toContain('ORDER');
    }
  });

  it('forgets the cached charts when an append fails halfway', async () => {
    const { collection, client } = build({
      Update: [
        { Attributes: { lines: [{ sku: 'A' }] } },
        Object.assign(new Error('throttled'), { name: 'ThrottlingException' }),
      ],
      Scan: () => ({ Items: [order([{ sku: 'A' }])] }),
    });
    const count = () =>
      collection.aggregate(caller, new Filter({}), { operation: 'Count' } as never);

    await count().catch(() => undefined);
    await expect(
      collection.create(caller, [
        { customerId: 'c1', orderId: 'o1', sku: 'A' },
        { customerId: 'c1', orderId: 'o1', sku: 'B' },
      ]),
    ).rejects.toThrow('throttled');

    expect(client.calls('Update')).toHaveLength(2);
  });
});

describe('native queries', () => {
  const orders = {
    Table: {
      TableName: 'Orders',
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    },
  };

  it('does not take a placeholder inside a string literal for a parameter', async () => {
    const client = fakeClient({
      DescribeTable: () => orders,
      Scan: () => ({ Items: [] }),
      ExecuteStatement: () => ({ Items: [] }),
    });
    const dataSource = await createDynamoDBDataSource({
      client,
      tables: ['Orders'],
      liveQueryConnection: 'dynamo',
    })(jest.fn(), jest.fn());

    await dataSource.executeNativeQuery(
      'dynamo',
      `SELECT * FROM "Orders" WHERE name = '$name' AND id = $id`,
      { id: 'a' },
    );

    expect(client.calls('ExecuteStatement')[0]).toEqual({
      Statement: `SELECT * FROM "Orders" WHERE name = '$name' AND id = ?`,
      Parameters: ['a'],
    });
  });

  it('stops following a statement that never ends', async () => {
    const client = fakeClient({
      DescribeTable: () => orders,
      Scan: () => ({ Items: [] }),
      ExecuteStatement: () => ({ Items: [], NextToken: 'again' }),
    });
    const dataSource = await createDynamoDBDataSource({
      client,
      tables: ['Orders'],
      liveQueryConnection: 'dynamo',
    })(jest.fn(), jest.fn());

    await expect(
      dataSource.executeNativeQuery('dynamo', 'SELECT * FROM "Orders" WHERE a = 1', {}),
    ).rejects.toThrow('still has results after 1000 pages');
  });
});
