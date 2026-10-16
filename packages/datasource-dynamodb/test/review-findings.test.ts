import {
  Filter,
  PaginatedFilter,
  Projection,
  Sort,
  Aggregation,
} from '@forestadmin/datasource-toolkit';

import { buildCollection } from './collection-helpers';
import { fakeClient } from './fake-client';
import { buildModel, buildSimpleModel, leaf } from './helpers';
import { introspectTable } from '../src/introspection/introspector';
import { validateManualSchema } from '../src/schema/manual-schema';

const caller = { timezone: 'UTC' } as never;

describe('pagination across timezones', () => {
  it('does not resume a page from a position remembered for another timezone', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), {
      Scan: [
        {
          Items: [
            { id: 'a', name: 'ab' },
            { id: 'b', name: 'ac' },
          ],
          LastEvaluatedKey: { id: 'b' },
        },
        { Items: [{ id: 'c', name: 'ad' }] },
      ],
    });
    const page = (timezone: string, skip: number) =>
      collection.list(
        { timezone } as never,
        new PaginatedFilter({
          conditionTree: leaf('name', 'ILike', 'a%'),
          page: { skip, limit: 1 } as never,
        }),
        new Projection('id'),
      );

    await page('Europe/Paris', 0);
    client.send.mockClear();
    await page('Asia/Tokyo', 1);

    expect(client.calls('Scan')[0].ExclusiveStartKey).toBeUndefined();
  });
});

describe('caches after a failed write', () => {
  it('forgets the cached charts when part of a bulk write failed', async () => {
    const { collection, client } = buildCollection(
      buildSimpleModel(),
      {
        Scan: () => ({ Items: [{ age: 1 }] }),
        Put: [{}, Object.assign(new Error('throttled'), { name: 'ThrottlingException' })],
      },
      { chartCacheTtlMs: 60000, scanConcurrency: 1 },
    );
    const sum = new Aggregation({ operation: 'Sum', field: 'age' });

    await collection.aggregate(caller, new Filter({}), sum);
    await expect(collection.create(caller, [{ id: 'a' }, { id: 'b' }])).rejects.toThrow(
      'throttled',
    );
    await collection.aggregate(caller, new Filter({}), sum);

    expect(client.calls('Scan')).toHaveLength(2);
  });
});

describe('sorting a large result', () => {
  it('sorts more records than a function call can take as arguments', async () => {
    const items = Array.from({ length: 150000 }, (_, i) => ({ id: `u${i}`, age: i % 1000 }));
    const { collection } = buildCollection(buildSimpleModel(), { Scan: () => ({ Items: items }) });

    const records = await collection.list(
      caller,
      new PaginatedFilter({
        sort: new Sort({ field: 'age', ascending: false }),
        page: { skip: 0, limit: 2 } as never,
      }),
      new Projection('age'),
    );

    expect(records).toEqual([{ age: 999 }, { age: 999 }]);
  });
});

describe('single-table discriminator', () => {
  const entityModel = () =>
    buildModel({
      entity: { attribute: 'entityType', value: 'ORDER' },
      schema: {
        customerId: { type: 'string' },
        orderId: { type: 'string' },
        entityType: { type: 'string' },
      },
    });

  it('refuses to create a record that claims another entity', async () => {
    const { collection, client } = buildCollection(entityModel(), { Put: () => ({}) });

    await expect(
      collection.create(caller, [{ customerId: 'c', orderId: 'o', entityType: 'USER' }]),
    ).rejects.toThrow("The attribute 'entityType' of 'orders' must be 'ORDER'");
    expect(client.calls('Put')).toHaveLength(0);
  });

  it('accepts the discriminator of its own entity', async () => {
    const { collection, client } = buildCollection(entityModel(), { Put: () => ({}) });

    await collection.create(caller, [{ customerId: 'c', orderId: 'o', entityType: 'ORDER' }]);

    expect(client.calls('Put')[0].Item.entityType).toBe('ORDER');
  });

  it('refuses to move a record to another entity', async () => {
    const { collection } = buildCollection(entityModel(), {});

    await expect(
      collection.update(caller, new Filter({ conditionTree: leaf('customerId', 'Equal', 'c') }), {
        entityType: 'USER',
      }),
    ).rejects.toThrow(
      "The attribute 'entityType' tells which entity a record of 'orders' belongs to",
    );
  });
});

describe('batch requests', () => {
  it('asks for each key once', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), {
      BatchGet: () => ({ Responses: { Users: [{ id: 'a' }] } }),
    });

    await collection.list(
      caller,
      new PaginatedFilter({ conditionTree: leaf('id', 'In', ['a', 'a']) }),
      new Projection('id'),
    );

    expect(client.calls('BatchGet')[0].RequestItems.Users.Keys).toEqual([{ id: 'a' }]);
  });

  it('logs the capacity consumed by batch reads and writes', async () => {
    const { collection, logger } = buildCollection(
      buildSimpleModel(),
      {
        BatchGet: () => ({
          Responses: { Users: [{ id: 'a' }] },
          ConsumedCapacity: [{ CapacityUnits: 1.5 }, { CapacityUnits: 0.5 }],
        }),
        BatchWrite: () => ({ ConsumedCapacity: [{ CapacityUnits: 3 }] }),
      },
      { logConsumedCapacity: true },
    );

    await collection.list(
      caller,
      new PaginatedFilter({ conditionTree: leaf('id', 'Equal', 'a') }),
      new Projection('id'),
    );
    await collection.delete(caller, new Filter({ conditionTree: leaf('id', 'Equal', 'a') }));

    expect(logger).toHaveBeenCalledWith('Info', '[DynamoDB Capacity] users.batchGet: 2 units');
    expect(logger).toHaveBeenCalledWith('Info', '[DynamoDB Capacity] users.batchDelete: 3 units');
  });
});

describe('introspection of unusual attribute names', () => {
  it.each(['constructor', 'toString', '__proto__'])('infers an attribute named %s', async name => {
    const item = Object.fromEntries([['id', 'a']]);
    Object.defineProperty(item, name, { value: 'x', enumerable: true, configurable: true });
    const client = fakeClient({
      DescribeTable: () => ({
        Table: {
          TableName: 'T',
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        },
      }),
      Scan: () => ({ Items: [item] }),
    });

    const { schema } = await introspectTable(client, { collectionName: 't', tableName: 'T' });

    expect(Object.keys(schema).sort()).toEqual(['id', name].sort());
  });
});

describe('manual schema entity', () => {
  const withEntity = (entity: Record<string, string>) => ({
    collections: [
      {
        name: 'c',
        tableName: 'T',
        partitionKey: { name: 'pk', type: 'string' as const },
        fields: [],
        entity,
      },
    ],
  });

  it.each([{ value: 'ORDER' }, { attribute: 'type' }])(
    'rejects a discriminator with only one of attribute and value: %p',
    entity => {
      expect(() => validateManualSchema(withEntity(entity))).toThrow(
        "Collection 'c' entity must use either 'attribute'/'value' or 'sortKeyPrefix'",
      );
    },
  );
});
