import { createDynamoDBDataSource } from '../src';
import { fakeClient } from './fake-client';

const orders = {
  Table: {
    TableName: 'Orders',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
  },
};

const build = (
  items: unknown[],
  virtualCollections = [
    { parentCollection: 'Orders', collectionName: 'lines', arrayField: 'lines' },
  ],
) => {
  const logger = jest.fn();
  const client = fakeClient({
    DescribeTable: () => orders,
    Scan: () => ({ Items: items }),
  });

  return {
    logger,
    client,
    dataSource: createDynamoDBDataSource({ client, tables: ['Orders'], virtualCollections })(
      logger,
      jest.fn(),
    ),
  };
};

describe('virtual collections', () => {
  it('exposes an array as a collection whose attributes are inferred from the items', async () => {
    const { dataSource } = build([
      {
        id: 'o1',
        lines: [
          { sku: 'A', qty: 1 },
          { sku: 'B', qty: 2, note: 'x' },
        ],
      },
      { id: 'o2', lines: [{ sku: 'C', qty: 3 }] },
    ]);

    const { fields } = (await dataSource).getCollection('lines').schema;

    expect(fields).toMatchObject({
      id: { isPrimaryKey: true, columnType: 'String', isReadOnly: true },
      index: { isPrimaryKey: true, columnType: 'Number', isReadOnly: true },
      sku: { columnType: 'String', isPrimaryKey: false },
      qty: { columnType: 'Number' },
      note: { columnType: 'String' },
    });
  });

  it('samples the parents that have the array, applying the filter on the items read', async () => {
    const { client, dataSource } = build([{ id: 'o1', lines: [{ sku: 'A' }] }, { id: 'o2' }]);

    const result = await dataSource;

    expect(client.calls('Scan')[0].FilterExpression).toBeUndefined();
    expect(result.getCollection('lines').schema.fields.sku).toBeDefined();
  });

  it('skips a collection whose parent does not exist, and says so', async () => {
    const { logger, dataSource } = build(
      [],
      [{ parentCollection: 'Missing', collectionName: 'lines', arrayField: 'lines' }],
    );

    const result = await dataSource;

    expect(result.collections.map(c => c.name)).toEqual(['Orders']);
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      expect.stringContaining("Skipping virtual collection 'lines' for array 'Missing.lines'"),
    );
  });

  it('exposes an array of an array, identified by the position in each', async () => {
    const { dataSource } = build(
      [{ id: 'o1', lines: [{ sku: 'A', parts: [{ n: 1 }, { n: 2 }] }] }],
      [
        { parentCollection: 'Orders', collectionName: 'lines', arrayField: 'lines' },
        { parentCollection: 'lines', collectionName: 'parts', arrayField: 'parts' },
      ],
    );

    const { fields } = (await dataSource).getCollection('parts').schema;

    expect(
      Object.entries(fields)
        .filter(([, field]) => field.type === 'Column' && field.isPrimaryKey)
        .map(([name]) => name),
    ).toEqual(['id', 'linesIndex', 'index']);
    expect(fields.n).toMatchObject({ columnType: 'Number', isPrimaryKey: false });
  });

  it('skips an array of an array declared before its parent, and says so', async () => {
    const { logger, dataSource } = build(
      [{ id: 'o1', lines: [{ sku: 'A', parts: [{ n: 1 }] }] }],
      [
        { parentCollection: 'lines', collectionName: 'parts', arrayField: 'parts' },
        { parentCollection: 'Orders', collectionName: 'lines', arrayField: 'lines' },
      ],
    );

    const result = await dataSource;

    expect(result.collections.map(c => c.name).sort()).toEqual(['Orders', 'lines']);
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      expect.stringContaining("Skipping virtual collection 'parts' for array 'lines.parts'"),
    );
  });

  it('uses the item schema a parent array collection declares when the sample is empty', async () => {
    const client = fakeClient({
      DescribeTable: () => orders,
      Scan: () => ({ Items: [] }),
    });

    const dataSource = await createDynamoDBDataSource({
      client,
      disableIntrospection: true,
      schema: {
        collections: [
          {
            name: 'Orders',
            tableName: 'Orders',
            partitionKey: { name: 'id', type: 'string' },
            fields: [
              {
                name: 'lines',
                type: 'array',
                subType: 'object',
                fields: [
                  {
                    name: 'parts',
                    type: 'array',
                    subType: 'object',
                    fields: [{ name: 'n', type: 'number' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      virtualCollections: [
        { parentCollection: 'Orders', collectionName: 'lines', arrayField: 'lines' },
        { parentCollection: 'lines', collectionName: 'parts', arrayField: 'parts' },
      ],
    })(jest.fn(), jest.fn());

    expect(dataSource.getCollection('parts').schema.fields.n).toMatchObject({
      columnType: 'Number',
    });
  });
});
