import { introspectTable, introspectTables } from '../../src/introspection/introspector';
import { fakeClient } from '../fake-client';

const describeTable = (overrides: Record<string, unknown> = {}) => ({
  Table: {
    TableName: 'Orders',
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
      {
        IndexName: 'keys-only',
        KeySchema: [{ AttributeName: 'status', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'KEYS_ONLY' },
      },
    ],
    LocalSecondaryIndexes: [
      {
        IndexName: 'by-created',
        KeySchema: [
          { AttributeName: 'customerId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    ...overrides,
  },
});

const items = [
  {
    customerId: 'c1',
    orderId: 'o1',
    status: 'paid',
    total: 12,
    createdAt: '2024-01-15T10:00:00Z',
    tags: new Set(['a']),
    address: { city: 'Paris', geo: { lat: 1 } },
    note: 'x',
  },
  { customerId: 'c1', orderId: 'o2', status: null, total: 3, createdAt: '2024-01-16T10:00:00Z' },
];

describe('introspectTable', () => {
  it('reads the key schema and the indexes from DescribeTable', async () => {
    const client = fakeClient({
      DescribeTable: () => describeTable(),
      Scan: () => ({ Items: items }),
    });

    const model = await introspectTable(client, { collectionName: 'orders', tableName: 'Orders' });

    expect(model).toMatchObject({
      name: 'orders',
      tableName: 'Orders',
      partitionKey: { name: 'customerId', type: 'S' },
      sortKey: { name: 'orderId', type: 'S' },
    });
    expect(model.indexes).toEqual([
      {
        name: 'by-status',
        type: 'GSI',
        partitionKey: { name: 'status', type: 'S' },
        sortKey: { name: 'createdAt', type: 'S' },
        projectsAllAttributes: true,
      },
      {
        name: 'keys-only',
        type: 'GSI',
        partitionKey: { name: 'status', type: 'S' },
        sortKey: undefined,
        projectsAllAttributes: false,
      },
      {
        name: 'by-created',
        type: 'LSI',
        partitionKey: { name: 'customerId', type: 'S' },
        sortKey: { name: 'createdAt', type: 'S' },
        projectsAllAttributes: true,
      },
    ]);
  });

  it('infers the attribute types from the sample, flattening nested maps', async () => {
    const client = fakeClient({
      DescribeTable: () => describeTable(),
      Scan: () => ({ Items: items }),
    });

    const { schema } = await introspectTable(client, {
      collectionName: 'orders',
      tableName: 'Orders',
    });

    expect(schema).toMatchObject({
      customerId: { type: 'string', nullable: false },
      orderId: { type: 'string', nullable: false },
      total: { type: 'number', nullable: false },
      createdAt: { type: 'date', nullable: false },
      tags: { type: 'array', nullable: true },
      'address->city': { type: 'string', nullable: true },
      'address->geo->lat': { type: 'number', nullable: true },
      note: { type: 'string', nullable: true },
    });
    expect(schema.address).toBeUndefined();
  });

  it('marks an attribute null in the sample as nullable', async () => {
    const client = fakeClient({
      DescribeTable: () => describeTable(),
      Scan: () => ({ Items: items }),
    });

    const { schema } = await introspectTable(client, {
      collectionName: 'orders',
      tableName: 'Orders',
    });

    expect(schema.status).toMatchObject({ type: 'string', nullable: true });
  });

  it('keeps a map as Json past the maximum depth', async () => {
    const client = fakeClient({
      DescribeTable: () => describeTable(),
      Scan: () => ({ Items: [{ customerId: 'c', orderId: 'o', a: { b: { c: 1 } } }] }),
    });

    const { schema } = await introspectTable(client, {
      collectionName: 'orders',
      tableName: 'Orders',
      maxDepth: 2,
    });

    expect(schema['a->b']).toMatchObject({ type: 'object' });
    expect(schema['a->b->c']).toBeUndefined();
  });

  it('declares the keys even when the table is empty', async () => {
    const client = fakeClient({
      DescribeTable: () => describeTable(),
      Scan: () => ({ Items: [] }),
    });

    const { schema } = await introspectTable(client, {
      collectionName: 'orders',
      tableName: 'Orders',
    });

    expect(schema).toEqual({
      customerId: { type: 'string', nullable: false },
      orderId: { type: 'string', nullable: false },
    });
  });

  it('types a numeric key as a number', async () => {
    const client = fakeClient({
      DescribeTable: () =>
        describeTable({
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'N' }],
          GlobalSecondaryIndexes: undefined,
          LocalSecondaryIndexes: undefined,
        }),
      Scan: () => ({ Items: [{ id: 1 }] }),
    });

    const model = await introspectTable(client, { collectionName: 'n', tableName: 'N' });

    expect(model.partitionKey).toEqual({ name: 'id', type: 'N' });
    expect(model.schema.id).toMatchObject({ type: 'number' });
    expect(model.sortKey).toBeUndefined();
    expect(model.indexes).toEqual([]);
  });

  it('samples with a Scan limited to the sample size', async () => {
    const client = fakeClient({
      DescribeTable: () => describeTable(),
      Scan: () => ({ Items: items }),
    });

    await introspectTable(client, {
      collectionName: 'orders',
      tableName: 'Orders',
      sampleSize: 50,
    });

    expect(client.calls('Scan')[0]).toMatchObject({ TableName: 'Orders', Limit: 50 });
  });

  it('keeps scanning until the sample is filled', async () => {
    const client = fakeClient({
      DescribeTable: () => describeTable(),
      Scan: [
        { Items: [items[0]], LastEvaluatedKey: { customerId: 'c1', orderId: 'o1' } },
        { Items: [items[1]] },
      ],
    });

    const { schema } = await introspectTable(client, {
      collectionName: 'orders',
      tableName: 'Orders',
      sampleSize: 10,
    });

    expect(client.calls('Scan')[1]).toMatchObject({
      ExclusiveStartKey: { customerId: 'c1', orderId: 'o1' },
    });
    expect(schema.total).toBeDefined();
  });

  it('restricts the sample to a single-table entity by discriminator attribute', async () => {
    const client = fakeClient({
      DescribeTable: () => describeTable(),
      Scan: () => ({ Items: items }),
    });

    const model = await introspectTable(client, {
      collectionName: 'orders',
      tableName: 'Orders',
      entity: { attribute: 'entityType', value: 'ORDER' },
    });

    expect(client.calls('Scan')[0]).toMatchObject({
      FilterExpression: '#n0 = :v0',
      ExpressionAttributeNames: { '#n0': 'entityType' },
      ExpressionAttributeValues: { ':v0': 'ORDER' },
    });
    expect(model.entity).toEqual({ attribute: 'entityType', value: 'ORDER' });
  });

  it('restricts the sample to a single-table entity by sort key prefix', async () => {
    const client = fakeClient({
      DescribeTable: () => describeTable(),
      Scan: () => ({ Items: items }),
    });

    await introspectTable(client, {
      collectionName: 'orders',
      tableName: 'Orders',
      entity: { sortKeyPrefix: 'ORDER#' },
    });

    expect(client.calls('Scan')[0]).toMatchObject({
      FilterExpression: 'begins_with(#n0, :v0)',
      ExpressionAttributeNames: { '#n0': 'orderId' },
      ExpressionAttributeValues: { ':v0': 'ORDER#' },
    });
  });

  it('refuses a sort key prefix on a table without sort key', async () => {
    const client = fakeClient({
      DescribeTable: () =>
        describeTable({
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        }),
      Scan: () => ({ Items: [] }),
    });

    await expect(
      introspectTable(client, {
        collectionName: 'n',
        tableName: 'N',
        entity: { sortKeyPrefix: 'X#' },
      }),
    ).rejects.toThrow("Table 'N' has no sort key, so 'sortKeyPrefix' cannot be used");
  });

  it('refuses a binary key', async () => {
    const client = fakeClient({
      DescribeTable: () =>
        describeTable({
          TableName: 'N',
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'B' }],
        }),
      Scan: () => ({ Items: [] }),
    });

    await expect(introspectTable(client, { collectionName: 'n', tableName: 'N' })).rejects.toThrow(
      "Key 'id' of table 'N' is binary, which is not supported",
    );
  });
});

describe('introspectTables', () => {
  it('introspects every table, naming collections after tables', async () => {
    const client = fakeClient({
      ListTables: () => ({ TableNames: ['Orders', 'Users'] }),
      DescribeTable: (input: { TableName: string }) =>
        input.TableName === 'Orders'
          ? describeTable()
          : describeTable({
              TableName: 'Users',
              KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
              AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
            }),
      Scan: () => ({ Items: [] }),
    });
    const logger = jest.fn();

    const models = await introspectTables(client, {}, logger);

    expect(models.map(m => m.name).sort()).toEqual(['Orders', 'Users']);
  });

  it('follows ListTables pagination', async () => {
    const client = fakeClient({
      ListTables: [{ TableNames: ['A'], LastEvaluatedTableName: 'A' }, { TableNames: ['B'] }],
      DescribeTable: (input: { TableName: string }) =>
        describeTable({
          TableName: input.TableName,
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        }),
      Scan: () => ({ Items: [] }),
    });

    const models = await introspectTables(client, {}, jest.fn());

    expect(client.calls('ListTables')[1]).toMatchObject({ ExclusiveStartTableName: 'A' });
    expect(models.map(m => m.name).sort()).toEqual(['A', 'B']);
  });

  it('only introspects the tables it is asked for', async () => {
    const client = fakeClient({
      DescribeTable: () => describeTable(),
      Scan: () => ({ Items: [] }),
    });

    await introspectTables(client, { tables: ['Orders'] }, jest.fn());

    expect(client.calls('ListTables')).toHaveLength(0);
    expect(client.calls('DescribeTable')).toHaveLength(1);
  });

  it('skips a table it cannot introspect and says why', async () => {
    const client = fakeClient({
      ListTables: () => ({ TableNames: ['Good', 'Bad'] }),
      DescribeTable: (input: { TableName: string }) => {
        if (input.TableName === 'Bad') throw new Error('AccessDeniedException');

        return describeTable({
          TableName: 'Good',
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        });
      },
      Scan: () => ({ Items: [] }),
    });
    const logger = jest.fn();

    const models = await introspectTables(client, {}, logger);

    expect(models.map(m => m.name)).toEqual(['Good']);
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      "Introspector - Skipping table 'Bad': AccessDeniedException",
    );
  });
});
