import type { DataSource } from '@forestadmin/datasource-toolkit';

import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  Aggregation,
  ConditionTreeFactory,
  Filter,
  PaginatedFilter,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';

import { createDynamoDBDataSource } from '../../src';

/**
 * Runs against DynamoDB Local (`docker compose up -d`, then DYNAMODB_ENDPOINT=http://localhost:8000):
 * the unit tests use a fake client, which cannot tell whether DynamoDB accepts the expressions.
 */
const endpoint = process.env.DYNAMODB_ENDPOINT;
const run = endpoint ? describe : describe.skip;

const caller = { timezone: 'UTC' } as never;
const suffix = `${Date.now()}`;
const ORDERS = `orders-${suffix}`;
const SHARED = `shared-${suffix}`;
const credentials = { accessKeyId: 'local', secretAccessKey: 'local' };

const tree = (plainTree: unknown) => ConditionTreeFactory.fromPlainObject(plainTree as never);
const leaf = (field: string, operator: string, value?: unknown) => tree({ field, operator, value });

run('DynamoDB Local', () => {
  let client: DynamoDBClient;
  let documents: DynamoDBDocumentClient;
  let dataSource: DataSource;
  let logger: jest.Mock;

  const orders = () => dataSource.getCollection('orders');

  beforeAll(async () => {
    client = new DynamoDBClient({ region: 'local', endpoint, credentials });
    documents = DynamoDBDocumentClient.from(client);

    await client.send(
      new CreateTableCommand({
        TableName: ORDERS,
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [
          { AttributeName: 'customerId', KeyType: 'HASH' },
          { AttributeName: 'orderId', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'customerId', AttributeType: 'S' },
          { AttributeName: 'orderId', AttributeType: 'S' },
          { AttributeName: 'status', AttributeType: 'S' },
          { AttributeName: 'createdAt', AttributeType: 'S' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'by-status',
            KeySchema: [
              { AttributeName: 'status', KeyType: 'HASH' },
              { AttributeName: 'createdAt', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      }),
    );
    await client.send(
      new CreateTableCommand({
        TableName: SHARED,
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
        ],
      }),
    );

    const items = Array.from({ length: 30 }, (_, i) => ({
      customerId: i < 20 ? 'c1' : 'c2',
      orderId: `o${String(i).padStart(2, '0')}`,
      status: i % 3 === 0 ? 'paid' : 'open',
      total: i + 1,
      createdAt: `2024-0${(i % 3) + 1}-15T10:00:00Z`,
      tags: new Set(['a']),
      ...(i === 0 ? { address: { city: 'Paris' } } : {}),
      ...(i === 1
        ? {
            lines: [
              { sku: 'A', qty: 1 },
              { sku: 'B', qty: 2 },
            ],
          }
        : {}),
    }));

    for (let i = 0; i < items.length; i += 25) {
      // eslint-disable-next-line no-await-in-loop
      await documents.send(
        new BatchWriteCommand({
          RequestItems: {
            [ORDERS]: items.slice(i, i + 25).map(Item => ({ PutRequest: { Item } })),
          },
        }),
      );
    }

    await documents.send(
      new BatchWriteCommand({
        RequestItems: {
          [SHARED]: [
            { PutRequest: { Item: { pk: 'ACC#1', sk: 'USER#1', name: 'Ann' } } },
            { PutRequest: { Item: { pk: 'ACC#1', sk: 'USER#2', name: 'Bob' } } },
            { PutRequest: { Item: { pk: 'ACC#1', sk: 'ORDER#1', total: 5 } } },
          ],
        },
      }),
    );

    logger = jest.fn();
    dataSource = await createDynamoDBDataSource({
      client: documents,
      builder: configurator =>
        configurator
          .addCollectionFromTable({ name: 'orders', tableName: ORDERS })
          .addCollectionFromTable({
            name: 'users',
            tableName: SHARED,
            entity: { sortKeyPrefix: 'USER#' },
          })
          .addCollectionFromTable({
            name: 'shared_orders',
            tableName: SHARED,
            entity: { sortKeyPrefix: 'ORDER#' },
          }),
      virtualCollections: [
        { parentCollection: 'orders', collectionName: 'order_lines', arrayField: 'lines' },
      ],
      liveQueryConnection: 'dynamo',
      chartCacheTtlMs: 0,
      scanConcurrency: 2,
    })(logger, jest.fn());
  });

  afterAll(async () => {
    for (const TableName of [ORDERS, SHARED]) {
      // eslint-disable-next-line no-await-in-loop
      await client.send(new DeleteTableCommand({ TableName })).catch(() => undefined);
    }
  });

  describe('introspection', () => {
    it('exposes the key as the primary key and infers the attributes', () => {
      expect(orders().schema.fields).toMatchObject({
        customerId: { isPrimaryKey: true, columnType: 'String' },
        orderId: { isPrimaryKey: true },
        total: { columnType: 'Number' },
        createdAt: { columnType: 'Date' },
        status: { columnType: 'String' },
      });
    });
  });

  describe('list', () => {
    it('queries a partition in sort key order', async () => {
      const records = await orders().list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('customerId', 'Equal', 'c1') }),
        new Projection('orderId'),
      );

      expect(records).toHaveLength(20);
      expect(records[0].orderId).toBe('o00');
      expect(records[19].orderId).toBe('o19');
    });

    it('reads backwards and pages through a sort key range', async () => {
      const records = await orders().list(
        caller,
        new PaginatedFilter({
          conditionTree: tree({
            aggregator: 'And',
            conditions: [
              { field: 'customerId', operator: 'Equal', value: 'c1' },
              { field: 'orderId', operator: 'GreaterThan', value: 'o02' },
              { field: 'orderId', operator: 'LessThan', value: 'o15' },
            ],
          }),
          sort: new Sort({ field: 'orderId', ascending: false }),
          page: { skip: 2, limit: 3 } as never,
        }),
        new Projection('orderId'),
      );

      expect(records.map(r => r.orderId)).toEqual(['o12', 'o11', 'o10']);
    });

    it('queries a global secondary index', async () => {
      logger.mockClear();

      const records = await orders().list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('status', 'Equal', 'paid') }),
        new Projection('orderId'),
      );

      expect(records).toHaveLength(10);
      expect(logger).not.toHaveBeenCalledWith('Warn', expect.stringContaining('Scan on table'));
    });

    it('scans, with a warning, for a filter no key serves', async () => {
      const records = await orders().list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('total', 'GreaterThan', 28) }),
        new Projection('orderId', 'total'),
      );

      expect(records.map(r => r.total).sort()).toEqual([29, 30]);
      expect(logger).toHaveBeenCalledWith('Warn', expect.stringContaining('Scan on table'));
    });

    it('evaluates operators DynamoDB lacks on the returned items', async () => {
      const records = await orders().list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('orderId', 'ILike', '%O1_') }),
        new Projection('orderId'),
      );

      expect(records.map(r => r.orderId).sort()).toEqual(
        Array.from({ length: 10 }, (_, i) => `o1${i}`),
      );
    });

    it('sorts on a non-key attribute', async () => {
      const records = await orders().list(
        caller,
        new PaginatedFilter({
          sort: new Sort({ field: 'total', ascending: false }),
          page: { skip: 0, limit: 2 } as never,
        }),
        new Projection('total'),
      );

      expect(records.map(r => r.total)).toEqual([30, 29]);
    });

    it('reads a global secondary index in its sort order', async () => {
      const records = await orders().list(
        caller,
        new PaginatedFilter({
          conditionTree: leaf('status', 'Equal', 'open'),
          sort: new Sort({ field: 'createdAt', ascending: false }),
          page: { skip: 0, limit: 3 } as never,
        }),
        new Projection('createdAt'),
      );

      expect(records.map(r => r.createdAt)).toEqual([
        '2024-03-15T10:00:00Z',
        '2024-03-15T10:00:00Z',
        '2024-03-15T10:00:00Z',
      ]);
    });

    it('pages through a scan, resuming from the keys it remembers', async () => {
      const page = async (skip: number) =>
        (
          await orders().list(
            caller,
            new PaginatedFilter({
              conditionTree: leaf('total', 'GreaterThan', 4),
              page: { skip, limit: 7 } as never,
            }),
            new Projection('orderId'),
          )
        ).map(r => r.orderId);

      const pages = [await page(0), await page(7), await page(14), await page(21), await page(7)];

      expect(pages.slice(0, 4).flat()).toHaveLength(26);
      expect(new Set(pages.slice(0, 4).flat()).size).toBe(26);
      expect(pages[4]).toEqual(pages[1]);
    });

    it('keeps a sort key bound out of the filter expression, where DynamoDB forbids it', async () => {
      const records = await dataSource.getCollection('users').list(
        caller,
        new PaginatedFilter({
          conditionTree: tree({
            aggregator: 'And',
            conditions: [
              { field: 'pk', operator: 'Equal', value: 'ACC#1' },
              { field: 'sk', operator: 'GreaterThan', value: 'USER#1' },
            ],
          }),
        }),
        new Projection('sk'),
      );

      expect(records.map(r => r.sk)).toEqual(['USER#2']);
    });

    it('reads whole keys with BatchGetItem', async () => {
      const records = await orders().list(
        caller,
        new PaginatedFilter({
          conditionTree: tree({
            aggregator: 'Or',
            conditions: [
              {
                aggregator: 'And',
                conditions: [
                  { field: 'customerId', operator: 'Equal', value: 'c1' },
                  { field: 'orderId', operator: 'Equal', value: 'o03' },
                ],
              },
              {
                aggregator: 'And',
                conditions: [
                  { field: 'customerId', operator: 'Equal', value: 'c2' },
                  { field: 'orderId', operator: 'Equal', value: 'o25' },
                ],
              },
            ],
          }),
        }),
        new Projection('orderId', 'total'),
      );

      expect(records.map(r => r.orderId).sort()).toEqual(['o03', 'o25']);
    });
  });

  describe('aggregate', () => {
    it('counts with a parallel scan', async () => {
      const result = await orders().aggregate(
        caller,
        new Filter({}),
        new Aggregation({ operation: 'Count' }),
      );

      expect(result).toEqual([{ value: 30, group: {} }]);
    });

    it('counts a filtered partition', async () => {
      const result = await orders().aggregate(
        caller,
        new Filter({ conditionTree: leaf('customerId', 'Equal', 'c2') }),
        new Aggregation({ operation: 'Count' }),
      );

      expect(result).toEqual([{ value: 10, group: {} }]);
    });

    it('sums by group and by month', async () => {
      const byStatus = await orders().aggregate(
        caller,
        new Filter({}),
        new Aggregation({ operation: 'Sum', field: 'total', groups: [{ field: 'status' }] }),
      );
      const byMonth = await orders().aggregate(
        caller,
        new Filter({}),
        new Aggregation({
          operation: 'Count',
          groups: [{ field: 'createdAt', operation: 'Month' }],
        }),
      );

      expect(byStatus.reduce((sum, row) => sum + (row.value as number), 0)).toBe(465);
      expect(byMonth.map(row => row.group.createdAt).sort()).toEqual([
        '2024-01-01',
        '2024-02-01',
        '2024-03-01',
      ]);
    });
  });

  describe('write', () => {
    it('creates, updates (also under a map that does not exist yet) and deletes', async () => {
      const key = { customerId: 'c9', orderId: 'o99' };
      await orders().create(caller, [{ ...key, total: 1, status: 'open' }]);

      await orders().update(
        caller,
        new Filter({
          conditionTree: tree({
            aggregator: 'And',
            conditions: [
              { field: 'customerId', operator: 'Equal', value: 'c9' },
              { field: 'orderId', operator: 'Equal', value: 'o99' },
            ],
          }),
        }),
        { total: 2, 'address->city': 'Lyon' },
      );

      const [updated] = await orders().list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('customerId', 'Equal', 'c9') }),
        new Projection('total', 'address->city'),
      );
      expect(updated).toEqual({ total: 2, 'address->city': 'Lyon' });

      await expect(orders().create(caller, [{ ...key, total: 3 }])).rejects.toThrow(
        'already exists',
      );

      await orders().delete(
        caller,
        new Filter({ conditionTree: leaf('customerId', 'Equal', 'c9') }),
      );
      const remaining = await orders().aggregate(
        caller,
        new Filter({ conditionTree: leaf('customerId', 'Equal', 'c9') }),
        new Aggregation({ operation: 'Count' }),
      );
      expect(remaining).toEqual([{ value: 0, group: {} }]);
    });
  });

  describe('single-table design', () => {
    it('keeps each collection to its own items', async () => {
      const users = await dataSource
        .getCollection('users')
        .list(
          caller,
          new PaginatedFilter({ conditionTree: leaf('pk', 'Equal', 'ACC#1') }),
          new Projection('sk', 'name'),
        );
      const sharedOrders = await dataSource
        .getCollection('shared_orders')
        .list(
          caller,
          new PaginatedFilter({ conditionTree: leaf('pk', 'Equal', 'ACC#1') }),
          new Projection('sk', 'total'),
        );

      expect(users.map(u => u.sk)).toEqual(['USER#1', 'USER#2']);
      expect(sharedOrders).toEqual([{ sk: 'ORDER#1', total: 5 }]);
    });
  });

  describe('virtual array collection', () => {
    it('lists, updates and deletes the items of an array', async () => {
      const lines = dataSource.getCollection('order_lines');
      const parent = ConditionTreeFactory.fromPlainObject({
        aggregator: 'And',
        conditions: [
          { field: 'customerId', operator: 'Equal', value: 'c1' },
          { field: 'orderId', operator: 'Equal', value: 'o01' },
        ],
      } as never);

      const before = await lines.list(
        caller,
        new PaginatedFilter({ conditionTree: parent }),
        new Projection('index', 'sku', 'qty'),
      );
      expect(before).toEqual([
        { index: 0, sku: 'A', qty: 1 },
        { index: 1, sku: 'B', qty: 2 },
      ]);

      await lines.update(caller, new Filter({ conditionTree: parent }), { qty: 7 });
      await lines.create(caller, [{ customerId: 'c1', orderId: 'o01', sku: 'C', qty: 3 }]);
      await lines.delete(
        caller,
        new Filter({
          conditionTree: ConditionTreeFactory.intersect(parent, leaf('sku', 'Equal', 'A')),
        }),
      );

      const after = await lines.list(
        caller,
        new PaginatedFilter({ conditionTree: parent }),
        new Projection('index', 'sku', 'qty'),
      );
      expect(after).toEqual([
        { index: 0, sku: 'B', qty: 7 },
        { index: 1, sku: 'C', qty: 3 },
      ]);
    });
  });

  describe('native query', () => {
    it('runs a PartiQL statement with parameters', async () => {
      const rows = await dataSource.executeNativeQuery(
        'dynamo',
        `SELECT orderId FROM "${ORDERS}" WHERE customerId = $customer AND orderId = $order`,
        { customer: 'c1', order: 'o05' },
      );

      expect(rows).toEqual([{ orderId: 'o05' }]);
    });
  });
});
