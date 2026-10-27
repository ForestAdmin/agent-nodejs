import type { DataSource } from '@forestadmin/datasource-toolkit';

import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  Aggregation,
  ConditionTreeFactory,
  Filter,
  PaginatedFilter,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';

import { createDynamoDBDataSource, introspect } from '../../src';

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
      ...(i === 2 ? { meta: { items: [{ x: 1 }, { x: 2 }] } } : {}),
      ...(i === 1
        ? {
            lines: [
              { sku: 'A', qty: 1, parts: [{ n: 1 }, { n: 2 }] },
              { sku: 'B', qty: 2, parts: [{ n: 3 }] },
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
        { parentCollection: 'order_lines', collectionName: 'line_parts', arrayField: 'parts' },
        { parentCollection: 'orders', collectionName: 'meta_items', arrayField: 'meta@@@items' },
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

    it('queries a global secondary index when a condition on its sort key is given', async () => {
      logger.mockClear();

      const records = await orders().list(
        caller,
        new PaginatedFilter({
          conditionTree: tree({
            aggregator: 'And',
            conditions: [
              { field: 'status', operator: 'Equal', value: 'paid' },
              { field: 'createdAt', operator: 'GreaterThan', value: '2000' },
            ],
          }),
        }),
        new Projection('orderId'),
      );

      expect(records).toHaveLength(10);
      expect(logger).not.toHaveBeenCalledWith('Warn', expect.stringContaining('Scan on table'));
    });

    it('does not let an index hide the items that lack its sort key', async () => {
      await documents.send(
        new PutCommand({
          TableName: ORDERS,
          Item: { customerId: 'c3', orderId: 'o90', status: 'paid', total: 1 },
        }),
      );

      const records = await orders().list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('status', 'Equal', 'paid') }),
        new Projection('orderId'),
      );
      await documents.send(
        new DeleteCommand({ TableName: ORDERS, Key: { customerId: 'c3', orderId: 'o90' } }),
      );

      expect(records.map(r => r.orderId)).toContain('o90');
      expect(records).toHaveLength(11);
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

    it('queries each partition of an In on the partition key', async () => {
      logger.mockClear();

      const records = await orders().list(
        caller,
        new PaginatedFilter({
          conditionTree: leaf('customerId', 'In', ['c1', 'c2']),
          page: { skip: 18, limit: 4 } as never,
        }),
        new Projection('customerId', 'orderId'),
      );
      const count = await orders().aggregate(
        caller,
        new Filter({ conditionTree: leaf('customerId', 'In', ['c1', 'c2']) }),
        new Aggregation({ operation: 'Count' }),
      );

      expect(records.map(r => `${r.customerId}${r.orderId}`)).toEqual([
        'c1o18',
        'c1o19',
        'c2o20',
        'c2o21',
      ]);
      expect(count).toEqual([{ value: 30, group: {} }]);
      expect(logger).not.toHaveBeenCalledWith('Warn', expect.stringContaining('Scan on table'));
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
        { total: 2, 'address@@@city': 'Lyon' },
      );

      const [updated] = await orders().list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('customerId', 'Equal', 'c9') }),
        new Projection('total', 'address@@@city'),
      );
      expect(updated).toEqual({ total: 2, 'address@@@city': 'Lyon' });

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
    it('lists, updates, appends to and deletes the items of an array inside an array', async () => {
      const parts = dataSource.getCollection('line_parts');
      const order = tree({
        aggregator: 'And',
        conditions: [
          { field: 'customerId', operator: 'Equal', value: 'c1' },
          { field: 'orderId', operator: 'Equal', value: 'o01' },
        ],
      });
      const read = () =>
        parts.list(
          caller,
          new PaginatedFilter({ conditionTree: order }),
          new Projection('order_linesIndex', 'index', 'n'),
        );

      expect(await read()).toEqual([
        { order_linesIndex: 0, index: 0, n: 1 },
        { order_linesIndex: 0, index: 1, n: 2 },
        { order_linesIndex: 1, index: 0, n: 3 },
      ]);

      await parts.update(caller, new Filter({ conditionTree: leaf('n', 'Equal', 3) }), { n: 9 });
      const created = await parts.create(caller, [
        { customerId: 'c1', orderId: 'o01', order_linesIndex: 1, n: 4 },
      ]);
      await parts.delete(
        caller,
        new Filter({
          conditionTree: ConditionTreeFactory.intersect(order, leaf('n', 'Equal', 1)),
        }),
      );

      expect(created).toEqual([
        { customerId: 'c1', orderId: 'o01', order_linesIndex: 1, index: 1, n: 4 },
      ]);
      expect(await read()).toEqual([
        { order_linesIndex: 0, index: 0, n: 2 },
        { order_linesIndex: 1, index: 0, n: 9 },
        { order_linesIndex: 1, index: 1, n: 4 },
      ]);
    });

    it('exposes an array held in a nested map', async () => {
      const items = dataSource.getCollection('meta_items');
      const order = tree({
        aggregator: 'And',
        conditions: [
          { field: 'customerId', operator: 'Equal', value: 'c1' },
          { field: 'orderId', operator: 'Equal', value: 'o02' },
        ],
      });
      const read = () =>
        items.list(
          caller,
          new PaginatedFilter({ conditionTree: order }),
          new Projection('index', 'x'),
        );

      await items.update(caller, new Filter({ conditionTree: leaf('x', 'Equal', 2) }), { x: 7 });
      const [created] = await items.create(caller, [{ customerId: 'c1', orderId: 'o02', x: 3 }]);
      await items.delete(
        caller,
        new Filter({ conditionTree: ConditionTreeFactory.intersect(order, leaf('x', 'Equal', 1)) }),
      );

      expect(created.index).toBe(2);
      expect(await read()).toEqual([
        { index: 0, x: 7 },
        { index: 1, x: 3 },
      ]);
    });

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

  describe('manual schema', () => {
    const MANUAL = `manual-${suffix}`;
    let manual: DataSource;
    let manualLogger: jest.Mock;

    beforeAll(async () => {
      await client.send(
        new CreateTableCommand({
          TableName: MANUAL,
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

      await documents.send(
        new BatchWriteCommand({
          RequestItems: {
            [MANUAL]: Array.from({ length: 6 }, (_, i) => ({
              PutRequest: {
                Item: {
                  customerId: 'c1',
                  orderId: `o${i}`,
                  status: i % 2 ? 'paid' : 'open',
                  total: i + 1,
                  createdAt: `2024-01-0${i + 1}T00:00:00Z`,
                  shipping: { city: i % 2 ? 'Paris' : 'Austin' },
                },
              },
            })),
          },
        }),
      );

      manualLogger = jest.fn();
      manual = await createDynamoDBDataSource(
        {
          client: documents,

          chartCacheTtlMs: 0,
        },
        {
          introspection: {
            collections: [
              {
                name: 'manual_orders',
                tableName: MANUAL,
                partitionKey: { name: 'customerId', type: 'string' },
                sortKey: { name: 'orderId', type: 'string' },
                indexes: [
                  {
                    name: 'by-status',
                    type: 'GSI',
                    partitionKey: { name: 'status', type: 'string' },
                    sortKey: { name: 'createdAt', type: 'string' },
                  },
                ],
                fields: [
                  { name: 'total', type: 'number' },
                  { name: 'status', type: 'string' },
                  { name: 'createdAt', type: 'date' },
                  { name: 'blob', type: 'binary', nullable: true },
                  { name: 'labels', type: 'array', subType: 'string', set: true, nullable: true },
                  { name: 'shipping', type: 'object', fields: [{ name: 'city', type: 'string' }] },
                ],
              },
            ],
          },
        },
      )(manualLogger, jest.fn());
    });

    afterAll(async () => {
      await client.send(new DeleteTableCommand({ TableName: MANUAL })).catch(() => undefined);
    });

    it('declares the keys, the typed attributes and the flattened nested ones', () => {
      expect(manual.getCollection('manual_orders').schema.fields).toMatchObject({
        customerId: { isPrimaryKey: true, columnType: 'String' },
        orderId: { isPrimaryKey: true, columnType: 'String' },
        total: { columnType: 'Number' },
        status: { columnType: 'String' },
        createdAt: { columnType: 'Date' },
        'shipping@@@city': { columnType: 'String' },
      });
    });

    it('exposes only the declared collections', () => {
      expect(manual.collections.map(c => c.name)).toEqual(['manual_orders']);
    });

    it('reads the declared index and filters on a nested attribute', async () => {
      manualLogger.mockClear();

      const records = await manual.getCollection('manual_orders').list(
        caller,
        new PaginatedFilter({
          conditionTree: tree({
            aggregator: 'And',
            conditions: [
              { field: 'status', operator: 'Equal', value: 'paid' },
              { field: 'createdAt', operator: 'GreaterThan', value: '2000-01-01T00:00:00Z' },
              { field: 'shipping@@@city', operator: 'Equal', value: 'Paris' },
            ],
          }),
        }),
        new Projection('orderId', 'shipping@@@city'),
      );

      expect(records.map(r => r.orderId).sort()).toEqual(['o1', 'o3', 'o5']);
      expect(manualLogger).not.toHaveBeenCalledWith(
        'Warn',
        expect.stringContaining('Scan on table'),
      );
    });

    it('stores a binary attribute as bytes and reads it back as base64', async () => {
      const collection = manual.getCollection('manual_orders');

      await collection.create(caller, [{ customerId: 'c8', orderId: 'o1', blob: 'AQID' }]);

      const stored = await documents.send(
        new GetCommand({ TableName: MANUAL, Key: { customerId: 'c8', orderId: 'o1' } }),
      );
      expect(Array.from(stored.Item.blob as Uint8Array)).toEqual([1, 2, 3]);

      const records = await collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('blob', 'Equal', 'AQID') }),
        new Projection('orderId', 'blob'),
      );
      expect(records).toEqual([{ orderId: 'o1', blob: 'AQID' }]);
    });

    it('writes a declared set back as a DynamoDB set', async () => {
      const collection = manual.getCollection('manual_orders');
      const key = { customerId: 'c7', orderId: 'o1' };

      await collection.create(caller, [{ ...key, labels: ['a', 'b'] }]);
      await collection.update(
        caller,
        new Filter({
          conditionTree: tree({
            aggregator: 'And',
            conditions: [
              { field: 'customerId', operator: 'Equal', value: 'c7' },
              { field: 'orderId', operator: 'Equal', value: 'o1' },
            ],
          }),
        }),
        { labels: ['b', 'c'] },
      );

      const stored = await documents.send(new GetCommand({ TableName: MANUAL, Key: key }));
      expect(stored.Item.labels).toBeInstanceOf(Set);
      expect([...stored.Item.labels].sort()).toEqual(['b', 'c']);

      await collection.update(
        caller,
        new Filter({
          conditionTree: tree({
            aggregator: 'And',
            conditions: [
              { field: 'customerId', operator: 'Equal', value: 'c7' },
              { field: 'orderId', operator: 'Equal', value: 'o1' },
            ],
          }),
        }),
        { labels: [] },
      );

      const cleared = await documents.send(new GetCommand({ TableName: MANUAL, Key: key }));
      expect(cleared.Item).toEqual(key);
    });

    it('creates, updates and deletes through the declared schema', async () => {
      const collection = manual.getCollection('manual_orders');
      const key = tree({
        aggregator: 'And',
        conditions: [
          { field: 'customerId', operator: 'Equal', value: 'c9' },
          { field: 'orderId', operator: 'Equal', value: 'o1' },
        ],
      });

      await collection.create(caller, [
        { customerId: 'c9', orderId: 'o1', total: 5, 'shipping@@@city': 'Rome' },
      ]);
      await collection.update(caller, new Filter({ conditionTree: key }), {
        'shipping@@@city': 'Milan',
      });

      expect(
        await collection.list(
          caller,
          new PaginatedFilter({ conditionTree: key }),
          new Projection('total', 'shipping@@@city'),
        ),
      ).toEqual([{ total: 5, 'shipping@@@city': 'Milan' }]);

      await collection.delete(caller, new Filter({ conditionTree: key }));

      expect(
        await collection.list(
          caller,
          new PaginatedFilter({ conditionTree: key }),
          new Projection('total'),
        ),
      ).toEqual([]);
    });
  });

  describe('writes through virtual collections of a composite key table', () => {
    const VC = `vc-${suffix}`;
    let vc: DataSource;

    const original = () => ({
      'c1|o1': {
        customerId: 'c1',
        orderId: 'o1',
        status: 'open',
        note: 'keep',
        lines: [
          { sku: 'A', qty: 1, parts: [{ n: 1 }, { n: 2 }] },
          { sku: 'B', qty: 2, parts: [{ n: 3 }] },
        ],
      },
      'c1|o2': {
        customerId: 'c1',
        orderId: 'o2',
        lines: [{ sku: 'A', qty: 10, parts: [{ n: 1 }] }],
      },
      'c2|o1': { customerId: 'c2', orderId: 'o1', lines: [{ sku: 'A', qty: 100, parts: [] }] },
    });

    const keyOf = (id: string) => {
      const [customerId, orderId] = id.split('|');

      return { customerId, orderId };
    };

    const raw = async (id: string) =>
      (await documents.send(new GetCommand({ TableName: VC, Key: keyOf(id) }))).Item;

    const at = (id: string, index: number, extra: Record<string, unknown> = {}) =>
      tree({
        aggregator: 'And',
        conditions: [
          { field: 'customerId', operator: 'Equal', value: keyOf(id).customerId },
          { field: 'orderId', operator: 'Equal', value: keyOf(id).orderId },
          { field: 'index', operator: 'Equal', value: index },
          ...Object.entries(extra).map(([field, value]) => ({
            field,
            operator: 'Equal',
            value,
          })),
        ],
      });

    beforeAll(async () => {
      await client.send(
        new CreateTableCommand({
          TableName: VC,
          BillingMode: 'PAY_PER_REQUEST',
          KeySchema: [
            { AttributeName: 'customerId', KeyType: 'HASH' },
            { AttributeName: 'orderId', KeyType: 'RANGE' },
          ],
          AttributeDefinitions: [
            { AttributeName: 'customerId', AttributeType: 'S' },
            { AttributeName: 'orderId', AttributeType: 'S' },
          ],
        }),
      );
      vc = await createDynamoDBDataSource({
        client: documents,
        builder: configurator =>
          configurator.addCollectionFromTable({ name: 'vc_orders', tableName: VC }),
        virtualCollections: [
          { parentCollection: 'vc_orders', collectionName: 'order_lines', arrayField: 'lines' },
          { parentCollection: 'order_lines', collectionName: 'line_parts', arrayField: 'parts' },
        ],
        chartCacheTtlMs: 0,
      })(jest.fn(), jest.fn());
    });

    beforeEach(async () => {
      await documents.send(
        new BatchWriteCommand({
          RequestItems: {
            [VC]: Object.values(original()).map(Item => ({ PutRequest: { Item } })),
          },
        }),
      );
    });

    afterAll(async () => {
      await client.send(new DeleteTableCommand({ TableName: VC })).catch(() => undefined);
    });

    it('edits the line of one order and leaves every other item and attribute alone', async () => {
      await vc
        .getCollection('order_lines')
        .update(caller, new Filter({ conditionTree: at('c1|o1', 1) }), { qty: 20 });

      const expected = original();
      expected['c1|o1'].lines[1].qty = 20;

      expect(await raw('c1|o1')).toEqual(expected['c1|o1']);
      expect(await raw('c1|o2')).toEqual(expected['c1|o2']);
      expect(await raw('c2|o1')).toEqual(expected['c2|o1']);
    });

    it('tells apart two items that share the sort key, or the partition key', async () => {
      await vc
        .getCollection('order_lines')
        .update(caller, new Filter({ conditionTree: at('c2|o1', 0) }), { sku: 'Z' });

      const expected = original();
      expected['c2|o1'].lines[0].sku = 'Z';

      expect(await raw('c2|o1')).toEqual(expected['c2|o1']);
      expect(await raw('c1|o1')).toEqual(expected['c1|o1']);
      expect(await raw('c1|o2')).toEqual(expected['c1|o2']);
    });

    it('edits the element of an array inside an array', async () => {
      await vc
        .getCollection('line_parts')
        .update(caller, new Filter({ conditionTree: at('c1|o1', 1, { order_linesIndex: 0 }) }), {
          n: 99,
        });

      const expected = original();
      expected['c1|o1'].lines[0].parts[1].n = 99;

      expect(await raw('c1|o1')).toEqual(expected['c1|o1']);
      expect(await raw('c1|o2')).toEqual(expected['c1|o2']);
    });

    it('deletes the line it names and keeps the order and its other lines', async () => {
      await vc
        .getCollection('order_lines')
        .delete(caller, new Filter({ conditionTree: at('c1|o1', 0) }));

      const expected = original();
      expected['c1|o1'].lines.splice(0, 1);

      expect(await raw('c1|o1')).toEqual(expected['c1|o1']);
      expect(await raw('c1|o2')).toEqual(expected['c1|o2']);
      expect(await raw('c2|o1')).toEqual(expected['c2|o1']);
    });

    it('appends a line to the order its keys name', async () => {
      const [created] = await vc
        .getCollection('order_lines')
        .create(caller, [{ customerId: 'c1', orderId: 'o2', sku: 'N', qty: 5 }]);

      const expected = original();
      expected['c1|o2'].lines.push({ sku: 'N', qty: 5 } as never);

      expect(created).toMatchObject({ customerId: 'c1', orderId: 'o2', index: 1 });
      expect(await raw('c1|o2')).toEqual(expected['c1|o2']);
      expect(await raw('c1|o1')).toEqual(expected['c1|o1']);
      expect(await raw('c2|o1')).toEqual(expected['c2|o1']);
    });
  });

  describe('introspect', () => {
    it('describes a table so that a datasource starts from it without sampling', async () => {
      const introspection = await introspect({ client: documents, tables: [ORDERS] });

      expect(JSON.parse(JSON.stringify(introspection))).toEqual(introspection);
      expect(introspection.collections[0]).toMatchObject({
        tableName: ORDERS,
        partitionKey: { name: 'customerId', type: 'string' },
        sortKey: { name: 'orderId', type: 'string' },
        indexes: [{ name: 'by-status', type: 'GSI' }],
      });

      const offline = await createDynamoDBDataSource({ client: documents }, { introspection })(
        jest.fn(),
        jest.fn(),
      );
      const records = await offline.getCollection(ORDERS).list(
        caller,
        new PaginatedFilter({
          conditionTree: tree({
            aggregator: 'And',
            conditions: [
              { field: 'customerId', operator: 'Equal', value: 'c1' },
              { field: 'orderId', operator: 'Equal', value: 'o05' },
            ],
          }),
        }),
        new Projection('customerId', 'orderId'),
      );

      expect(records).toEqual([{ customerId: 'c1', orderId: 'o05' }]);
    });

    it('keeps introspecting the other tables when the builder adjusts one', async () => {
      const adjusted = await createDynamoDBDataSource({
        client: documents,
        tables: [ORDERS],
        builder: configurator =>
          configurator.addCollectionFromTable({
            name: 'shared_users',
            tableName: SHARED,
            entity: { sortKeyPrefix: 'USER#' },
          }),
      })(jest.fn(), jest.fn());

      expect(adjusted.collections.map(c => c.name).sort()).toEqual([ORDERS, 'shared_users'].sort());
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
