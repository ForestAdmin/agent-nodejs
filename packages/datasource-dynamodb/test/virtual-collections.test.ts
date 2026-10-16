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

  it('samples only the parents that have the array', async () => {
    const { client, dataSource } = build([{ id: 'o1', lines: [{ sku: 'A' }] }]);

    await dataSource;

    const sample = client.calls('Scan').find(call => call.FilterExpression);
    expect(sample.FilterExpression).toBe(
      '(attribute_exists(#n0) AND NOT attribute_type(#n0, :v0))',
    );
    expect(sample.ExpressionAttributeNames['#n0']).toBe('lines');
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

  it('refuses to expose an array of a virtual collection', async () => {
    const { logger, dataSource } = build(
      [{ id: 'o1', lines: [{ sku: 'A', parts: [{ n: 1 }] }] }],
      [
        { parentCollection: 'Orders', collectionName: 'lines', arrayField: 'lines' },
        { parentCollection: 'lines', collectionName: 'parts', arrayField: 'parts' },
      ],
    );

    const result = await dataSource;

    expect(result.collections.map(c => c.name).sort()).toEqual(['Orders', 'lines']);
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      "Skipping virtual collection 'parts' for array 'lines.parts': an array of an array cannot be exposed",
    );
  });
});
