import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { fakeClient } from './fake-client';
import createDocumentClient from '../src/client';
import { createDynamoDBDataSource } from '../src/index';

const table = (name: string, keyType = 'S') => ({
  Table: {
    TableName: name,
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: keyType }],
  },
});

const handlers = () => ({
  ListTables: () => ({ TableNames: ['Users', 'Orders'] }),
  DescribeTable: (input: { TableName: string }) => table(input.TableName),
  Scan: () => ({ Items: [{ id: 'a', name: 'Bob' }] }),
});

describe('createDynamoDBDataSource', () => {
  it('introspects every table into a collection, sorted by name', async () => {
    const dataSource = await createDynamoDBDataSource({ client: fakeClient(handlers()) })(
      jest.fn(),
      jest.fn(),
    );

    expect(dataSource.collections.map(c => c.name)).toEqual(['Orders', 'Users']);
    expect(dataSource.getCollection('Users').schema.fields.name).toMatchObject({
      columnType: 'String',
    });
  });

  it('only introspects the listed tables', async () => {
    const client = fakeClient(handlers());

    const dataSource = await createDynamoDBDataSource({ client, tables: ['Users'] })(
      jest.fn(),
      jest.fn(),
    );

    expect(dataSource.collections.map(c => c.name)).toEqual(['Users']);
    expect(client.calls('ListTables')).toHaveLength(0);
  });

  it('builds collections from the builder, with a custom name and an entity', async () => {
    const client = fakeClient({
      DescribeTable: (input: { TableName: string }) => table(input.TableName),
      Scan: () => ({ Items: [] }),
    });

    const dataSource = await createDynamoDBDataSource({
      client,
      tables: [],
      builder: configurator =>
        configurator.addCollectionFromTable({
          name: 'customers',
          tableName: 'AppTable',
          entity: { attribute: 'entityType', value: 'CUSTOMER' },
          sampleSize: 20,
          scanPolicy: 'deny',
        }),
    })(jest.fn(), jest.fn());

    expect(dataSource.collections.map(c => c.name)).toEqual(['customers']);
    expect(client.calls('Scan')[0]).toMatchObject({ TableName: 'AppTable', Limit: 20 });
    expect(client.calls('ListTables')).toHaveLength(0);
  });

  it('builds collections from a given introspection without calling AWS', async () => {
    const client = fakeClient({});

    const dataSource = await createDynamoDBDataSource(
      {
        client,
      },
      {
        introspection: {
          collections: [
            {
              name: 'users',
              tableName: 'Users',
              partitionKey: { name: 'id', type: 'string' },
              fields: [{ name: 'name', type: 'string' }],
            },
          ],
        },
      },
    )(jest.fn(), jest.fn());

    expect(dataSource.getCollection('users').schema.fields.name).toMatchObject({
      columnType: 'String',
    });
    expect(client.send).not.toHaveBeenCalled();
  });

  it('rejects an invalid introspection', async () => {
    const factory = createDynamoDBDataSource(
      {
        client: fakeClient({}),
      },
      { introspection: { collections: [] } },
    );

    await expect(factory(jest.fn(), jest.fn())).rejects.toThrow(
      'The introspection must have at least one collection',
    );
  });

  it('warns when nothing could be introspected', async () => {
    const logger = jest.fn();

    await createDynamoDBDataSource({
      client: fakeClient({ ListTables: () => ({ TableNames: [] }) }),
    })(logger, jest.fn());

    expect(logger).toHaveBeenCalledWith('Warn', 'No collections were introspected.');
  });

  it('applies the datasource settings to its collections', async () => {
    const client = fakeClient({
      ...handlers(),
      Scan: () => ({ Items: [] }),
    });

    const dataSource = await createDynamoDBDataSource({ client, scanPolicy: 'deny' })(
      jest.fn(),
      jest.fn(),
    );

    await expect(
      dataSource
        .getCollection('Users')
        .list({ timezone: 'UTC' } as never, { page: undefined } as never, ['id'] as never),
    ).rejects.toThrow("refused by scanPolicy 'deny'");
  });

  describe('native queries (PartiQL)', () => {
    const build = (extra: Record<string, unknown> = {}) =>
      createDynamoDBDataSource({
        client: fakeClient({
          ...handlers(),
          ExecuteStatement: [{ Items: [{ id: 'a' }], NextToken: 'next' }, { Items: [{ id: 'b' }] }],
          ...extra,
        }),
        tables: ['Users'],
        liveQueryConnection: 'dynamo',
      });

    it('runs a statement with positional parameters and follows NextToken', async () => {
      const client = fakeClient({
        ...handlers(),
        ExecuteStatement: [{ Items: [{ id: 'a' }], NextToken: 'next' }, { Items: [{ id: 'b' }] }],
      });
      const dataSource = await createDynamoDBDataSource({
        client,
        tables: ['Users'],
        liveQueryConnection: 'dynamo',
      })(jest.fn(), jest.fn());

      const rows = await dataSource.executeNativeQuery(
        'dynamo',
        'SELECT * FROM "Users" WHERE id = $id AND age > $age AND id <> $id',
        { id: 'a', age: 3 },
      );

      expect(rows).toEqual([{ id: 'a' }, { id: 'b' }]);
      expect(client.calls('ExecuteStatement')).toEqual([
        {
          Statement: 'SELECT * FROM "Users" WHERE id = ? AND age > ? AND id <> ?',
          Parameters: ['a', 3, 'a'],
        },
        {
          Statement: 'SELECT * FROM "Users" WHERE id = ? AND age > ? AND id <> ?',
          Parameters: ['a', 3, 'a'],
          NextToken: 'next',
        },
      ]);
    });

    it('refuses a placeholder without value', async () => {
      const dataSource = await build()(jest.fn(), jest.fn());

      await expect(
        dataSource.executeNativeQuery('dynamo', 'SELECT * FROM "Users" WHERE id = $id', {}),
      ).rejects.toThrow('No value was given for the placeholder $id');
    });

    it('refuses an unknown connection', async () => {
      const dataSource = await build()(jest.fn(), jest.fn());

      await expect(dataSource.executeNativeQuery('nope', 'SELECT 1', {})).rejects.toThrow(
        "Unknown connection name 'nope'",
      );
    });

    it('is not available unless a connection name is configured', async () => {
      const dataSource = await createDynamoDBDataSource({ client: fakeClient(handlers()) })(
        jest.fn(),
        jest.fn(),
      );

      expect(Object.keys(dataSource.nativeQueryConnections)).toEqual([]);
    });
  });
});

describe('createDocumentClient', () => {
  it('builds a client from region, endpoint and credentials', async () => {
    const client = createDocumentClient({
      region: 'eu-west-1',
      endpoint: 'http://localhost:8000',
      credentials: { accessKeyId: 'k', secretAccessKey: 's' },
    });

    expect(client).toBeInstanceOf(DynamoDBDocumentClient);
    expect(await client.config.region()).toBe('eu-west-1');
    expect(await client.config.maxAttempts()).toBe(10);
  });

  it('lets the user tune the underlying client', async () => {
    const client = createDocumentClient({
      region: 'eu-west-1',
      clientConfig: { maxAttempts: 3 },
    });

    expect(await client.config.maxAttempts()).toBe(3);
  });

  it('wraps an existing low-level client', () => {
    const client = createDocumentClient({ client: new DynamoDBClient({ region: 'eu-west-1' }) });

    expect(client).toBeInstanceOf(DynamoDBDocumentClient);
  });

  it('uses an existing document client as is', () => {
    const existing = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'eu-west-1' }));

    expect(createDocumentClient({ client: existing })).toBe(existing);
  });
});
