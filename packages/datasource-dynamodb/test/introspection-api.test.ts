import { fakeClient } from './fake-client';
import { createDynamoDBDataSource, introspect } from '../src';
import { convertManualSchema } from '../src/schema/manual-schema';

const ordersTable = {
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
    ],
  },
};

const orders = [
  {
    customerId: 'c1',
    orderId: 'o1',
    status: 'paid',
    total: 12,
    createdAt: '2024-01-15T10:00:00Z',
    tags: new Set(['a']),
    address: { city: 'Paris', geo: { lat: 1 } },
    lines: [{ sku: 'A' }],
  },
  { customerId: 'c1', orderId: 'o2', status: null, total: 3, createdAt: '2024-01-16T10:00:00Z' },
];

const awsClient = () =>
  fakeClient({
    ListTables: () => ({ TableNames: ['Orders'] }),
    DescribeTable: () => ordersTable,
    Scan: () => ({ Items: orders }),
  });

const appTable = (name: string) => ({
  Table: {
    TableName: name,
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
    ],
  },
});

describe('introspect', () => {
  it('describes each table as a collection definition', async () => {
    const introspection = await introspect({ client: awsClient() });

    expect(introspection.version).toBe(1);
    expect(introspection.collections).toHaveLength(1);
    expect(introspection.collections[0]).toMatchObject({
      name: 'Orders',
      tableName: 'Orders',
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
    });
    expect(introspection.collections[0].fields).toEqual(
      expect.arrayContaining([
        { name: 'total', type: 'number', nullable: false },
        { name: 'tags', type: 'array', set: true, nullable: true },
        {
          name: 'address',
          type: 'object',
          fields: [
            { name: 'city', type: 'string', nullable: true },
            {
              name: 'geo',
              type: 'object',
              fields: [{ name: 'lat', type: 'number', nullable: true }],
            },
          ],
        },
      ]),
    );
    expect(introspection.collections[0].fields.map(field => field.name)).not.toContain('orderId');
  });

  it('survives a trip through JSON', async () => {
    const introspection = await introspect({ client: awsClient() });

    expect(JSON.parse(JSON.stringify(introspection))).toEqual(introspection);
  });

  it('builds the same collections as the live introspection, without calling AWS', async () => {
    const live = await createDynamoDBDataSource({ client: awsClient() })(jest.fn(), jest.fn());
    const introspection = await introspect({ client: awsClient() });
    const offline = fakeClient({});

    const dataSource = await createDynamoDBDataSource({ client: offline }, { introspection })(
      jest.fn(),
      jest.fn(),
    );

    expect(dataSource.getCollection('Orders').schema).toEqual(live.getCollection('Orders').schema);
    expect(offline.send).not.toHaveBeenCalled();
  });

  it('refuses an introspection of another version', async () => {
    const factory = createDynamoDBDataSource(
      { client: fakeClient({}) },
      { introspection: { version: 2, collections: [] } as never },
    );

    await expect(factory(jest.fn(), jest.fn())).rejects.toThrow(
      'The introspection is in version 2, this datasource reads version 1',
    );
  });

  it('refuses an introspection with a builder', async () => {
    const factory = createDynamoDBDataSource(
      { client: fakeClient({}), builder: configurator => configurator },
      { introspection: { version: 1, collections: [] } },
    );

    await expect(factory(jest.fn(), jest.fn())).rejects.toThrow(
      'An introspection and a builder cannot be used together',
    );
  });
});

describe('the builder next to the introspection', () => {
  const client = () =>
    fakeClient({
      ListTables: () => ({ TableNames: ['App', 'Other'] }),
      DescribeTable: (input: { TableName: string }) => appTable(input.TableName),
      Scan: () => ({ Items: [] }),
    });
  const twoEntities = (configurator: any) =>
    configurator
      .addCollectionFromTable({
        name: 'users',
        tableName: 'App',
        entity: { sortKeyPrefix: 'USER#' },
      })
      .addCollectionFromTable({
        name: 'orders',
        tableName: 'App',
        entity: { sortKeyPrefix: 'ORDER#' },
      });

  it('keeps introspecting the tables it does not name', async () => {
    const dataSource = await createDynamoDBDataSource({
      client: client(),
      builder: twoEntities,
    })(jest.fn(), jest.fn());

    expect(dataSource.collections.map(c => c.name)).toEqual(['Other', 'orders', 'users']);
  });

  it('introspects the table the builder names only once', async () => {
    const aws = client();

    await createDynamoDBDataSource({ client: aws, builder: twoEntities })(jest.fn(), jest.fn());

    const described = aws.calls('DescribeTable').map(input => input.TableName);
    expect(described.filter(name => name === 'App')).toHaveLength(2);
    expect(described.filter(name => name === 'Other')).toHaveLength(1);
  });

  it('exposes only the builder collections when no table is listed', async () => {
    const aws = client();

    const dataSource = await createDynamoDBDataSource({
      client: aws,
      tables: [],
      builder: twoEntities,
    })(jest.fn(), jest.fn());

    expect(dataSource.collections.map(c => c.name)).toEqual(['orders', 'users']);
    expect(aws.calls('ListTables')).toHaveLength(0);
  });

  it('introspects the listed tables next to the builder collections', async () => {
    const dataSource = await createDynamoDBDataSource({
      client: client(),
      tables: ['Other'],
      builder: twoEntities,
    })(jest.fn(), jest.fn());

    expect(dataSource.collections.map(c => c.name)).toEqual(['Other', 'orders', 'users']);
  });
});

describe('an object field without nested fields', () => {
  it('is a column of its own', () => {
    const [table] = convertManualSchema({
      collections: [
        {
          name: 'a',
          tableName: 'A',
          partitionKey: { name: 'id', type: 'string' },
          fields: [{ name: 'meta', type: 'object' }],
        },
      ],
    });

    expect(table.schema.meta).toMatchObject({ type: 'object' });
  });
});
