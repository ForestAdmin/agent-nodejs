import { PaginatedFilter, Projection, Sort } from '@forestadmin/datasource-toolkit';

import { buildCollection } from './collection-helpers';
import { and, buildModel, buildSimpleModel, leaf, or, plain } from './helpers';

const caller = { timezone: 'UTC' } as never;
const order = (n: number, extra = {}) => ({
  customerId: 'c1',
  orderId: `o${n}`,
  total: n,
  ...extra,
});

describe('DynamoDBCollection.list', () => {
  describe('access path', () => {
    it('queries the table with a key condition when the partition key is pinned', async () => {
      const { collection, client } = buildCollection(buildModel(), {
        Query: () => ({ Items: [order(1)] }),
      });

      const records = await collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('customerId', 'Equal', 'c1') }),
        new Projection('customerId', 'orderId', 'total'),
      );

      expect(records).toEqual([{ customerId: 'c1', orderId: 'o1', total: 1 }]);
      expect(client.calls('Query')[0]).toMatchObject({
        TableName: 'Orders',
        KeyConditionExpression: '#n0 = :v0',
        ProjectionExpression: '#n0, #n1, #n2',
        ExpressionAttributeNames: { '#n0': 'customerId', '#n1': 'orderId', '#n2': 'total' },
        ExpressionAttributeValues: { ':v0': 'c1' },
      });
      expect(client.calls('Query')[0].FilterExpression).toBeUndefined();
    });

    it('puts the remaining conditions in a filter expression', async () => {
      const { collection, client } = buildCollection(buildModel(), {
        Query: () => ({ Items: [] }),
      });

      await collection.list(
        caller,
        new PaginatedFilter({
          conditionTree: and(plain('customerId', 'Equal', 'c1'), plain('status', 'Equal', 'paid')),
        }),
        new Projection('orderId'),
      );

      expect(client.calls('Query')[0]).toMatchObject({
        KeyConditionExpression: '#n0 = :v0',
        FilterExpression: '#n1 = :v1',
        ExpressionAttributeValues: { ':v0': 'c1', ':v1': 'paid' },
      });
    });

    it('queries a secondary index when its partition key is pinned', async () => {
      const { collection, client } = buildCollection(
        buildModel({
          indexes: [
            {
              name: 'by-status',
              type: 'GSI',
              partitionKey: { name: 'status', type: 'S' },
              projectsAllAttributes: true,
            },
          ],
        }),
        { Query: () => ({ Items: [] }) },
      );

      await collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('status', 'Equal', 'paid') }),
        new Projection('orderId'),
      );

      expect(client.calls('Query')[0]).toMatchObject({ IndexName: 'by-status' });
    });

    it('scans when no key is pinned', async () => {
      const { collection, client } = buildCollection(buildModel(), {
        Scan: () => ({ Items: [order(1)] }),
      });

      await collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('status', 'Equal', 'paid') }),
        new Projection('orderId'),
      );

      expect(client.calls('Scan')[0]).toMatchObject({
        TableName: 'Orders',
        FilterExpression: '#n0 = :v0',
      });
    });

    it('reads the sort key backwards for a descending sort', async () => {
      const { collection, client } = buildCollection(buildModel(), {
        Query: () => ({ Items: [] }),
      });

      await collection.list(
        caller,
        new PaginatedFilter({
          conditionTree: leaf('customerId', 'Equal', 'c1'),
          sort: new Sort({ field: 'orderId', ascending: false }),
        }),
        new Projection('orderId'),
      );

      expect(client.calls('Query')[0].ScanIndexForward).toBe(false);
    });

    it('looks keys up with BatchGetItem when the filter pins whole keys', async () => {
      const { collection, client } = buildCollection(buildModel(), {
        BatchGet: () => ({
          Responses: { Orders: [order(1), order(2)] },
        }),
      });

      const records = await collection.list(
        caller,
        new PaginatedFilter({
          conditionTree: or(
            and(plain('customerId', 'Equal', 'c1'), plain('orderId', 'Equal', 'o1')),
            and(plain('customerId', 'Equal', 'c1'), plain('orderId', 'Equal', 'o2')),
          ),
        }),
        new Projection('customerId', 'orderId', 'total'),
      );

      expect(records).toHaveLength(2);
      expect(client.calls('BatchGet')[0].RequestItems.Orders.Keys).toEqual([
        { customerId: 'c1', orderId: 'o1' },
        { customerId: 'c1', orderId: 'o2' },
      ]);
      expect(client.calls('Query')).toHaveLength(0);
      expect(client.calls('Scan')).toHaveLength(0);
    });

    it('splits a BatchGetItem in chunks of 100 keys and retries unprocessed keys', async () => {
      const ids = Array.from({ length: 120 }, (_, i) => `u${i}`);
      let call = 0;
      const { collection, client } = buildCollection(buildSimpleModel(), {
        BatchGet: (input: any) => {
          call += 1;
          const keys = input.RequestItems.Users.Keys as Array<{ id: string }>;

          if (call === 1) {
            return {
              Responses: { Users: keys.slice(0, 99).map(k => ({ id: k.id })) },
              UnprocessedKeys: { Users: { Keys: [keys[99]] } },
            };
          }

          return { Responses: { Users: keys.map(k => ({ id: k.id })) } };
        },
      });

      const records = await collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('id', 'In', ids) }),
        new Projection('id'),
      );

      expect(records).toHaveLength(120);
      expect(client.calls('BatchGet').map(c => c.RequestItems.Users.Keys.length)).toEqual([
        100, 1, 20,
      ]);
    });

    it('applies the remaining filter to a key lookup', async () => {
      const { collection } = buildCollection(buildSimpleModel(), {
        BatchGet: () => ({
          Responses: {
            Users: [
              { id: 'u1', age: 10 },
              { id: 'u2', age: 50 },
            ],
          },
        }),
      });

      const records = await collection.list(
        caller,
        new PaginatedFilter({
          conditionTree: and(plain('id', 'In', ['u1', 'u2']), plain('age', 'GreaterThan', 20)),
        }),
        new Projection('id', 'age'),
      );

      expect(records).toEqual([{ id: 'u2', age: 50 }]);
    });
  });

  describe('scan policy', () => {
    it('warns by default when it has to scan, without leaking filter values', async () => {
      const { collection, logger } = buildCollection(buildModel(), {
        Scan: () => ({ Items: [] }),
      });

      await collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('status', 'Equal', 'secret-value') }),
        new Projection('orderId'),
      );

      expect(logger).toHaveBeenCalledWith(
        'Warn',
        "Scan on table 'Orders' for collection 'orders': no key or index serves the filter (status Equal)",
      );
      expect(JSON.stringify(logger.mock.calls)).not.toContain('secret-value');
    });

    it('does not warn when the scan policy is allow', async () => {
      const { collection, logger } = buildCollection(buildModel({ scanPolicy: 'allow' }), {
        Scan: () => ({ Items: [] }),
      });

      await collection.list(caller, new PaginatedFilter({}), new Projection('orderId'));

      expect(logger).not.toHaveBeenCalledWith('Warn', expect.stringContaining('Scan on table'));
    });

    it('refuses to scan when the scan policy is deny', async () => {
      const { collection, client } = buildCollection(buildModel({ scanPolicy: 'deny' }), {
        Scan: () => ({ Items: [] }),
      });

      await expect(
        collection.list(caller, new PaginatedFilter({}), new Projection('orderId')),
      ).rejects.toThrow(
        "Scan on table 'Orders' refused by scanPolicy 'deny': no key or index serves the filter",
      );
      expect(client.calls('Scan')).toHaveLength(0);
    });

    it('lets the collection override the datasource policy', async () => {
      const { collection } = buildCollection(
        buildModel({ scanPolicy: 'allow' }),
        { Scan: () => ({ Items: [] }) },
        { scanPolicy: 'deny' },
      );

      await expect(
        collection.list(caller, new PaginatedFilter({}), new Projection('orderId')),
      ).resolves.toEqual([]);
    });

    it('still queries under a deny policy', async () => {
      const { collection } = buildCollection(buildModel({ scanPolicy: 'deny' }), {
        Query: () => ({ Items: [order(1)] }),
      });

      await expect(
        collection.list(
          caller,
          new PaginatedFilter({ conditionTree: leaf('customerId', 'Equal', 'c1') }),
          new Projection('orderId'),
        ),
      ).resolves.toHaveLength(1);
    });

    it('stops a scan that reads more items than maxScannedItems', async () => {
      const { collection } = buildCollection(buildModel({ maxScannedItems: 3 }), {
        Scan: () => ({
          Items: [order(1), order(2)],
          ScannedCount: 2,
          LastEvaluatedKey: { customerId: 'c1', orderId: 'o2' },
        }),
      });

      await expect(
        collection.list(
          caller,
          new PaginatedFilter({ conditionTree: leaf('status', 'Equal', 'x') }),
          new Projection('orderId'),
        ),
      ).rejects.toThrow("Scan on table 'Orders' stopped after 4 items: maxScannedItems is 3");
    });
  });

  describe('client-side evaluation', () => {
    it('evaluates operators DynamoDB lacks on the returned items', async () => {
      const { collection, client } = buildCollection(buildSimpleModel(), {
        Scan: () => ({
          Items: [
            { id: 'u1', name: 'Émile' },
            { id: 'u2', name: 'Bob' },
          ],
        }),
      });

      const records = await collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('name', 'ILike', '%émi%') }),
        new Projection('id'),
      );

      expect(records).toEqual([{ id: 'u1' }]);
      expect(client.calls('Scan')[0].FilterExpression).toBeUndefined();
      expect(client.calls('Scan')[0].ProjectionExpression).toBe('#n0, #n1');
    });

    it('pushes the supported part of the filter and evaluates the rest on the items', async () => {
      const { collection, client } = buildCollection(buildSimpleModel(), {
        Scan: () => ({
          Items: [
            { id: 'u1', name: 'abc', age: 30 },
            { id: 'u2', name: 'xbz', age: 30 },
          ],
        }),
      });

      const records = await collection.list(
        caller,
        new PaginatedFilter({
          conditionTree: and(plain('age', 'Equal', 30), plain('name', 'EndsWith', 'c')),
        }),
        new Projection('id'),
      );

      expect(records).toEqual([{ id: 'u1' }]);
      expect(client.calls('Scan')[0].FilterExpression).toBe('#n0 = :v0');
    });
  });

  describe('sort', () => {
    it('sorts on a non-key attribute after reading the matching items', async () => {
      const { collection } = buildCollection(buildModel(), {
        Query: () => ({ Items: [order(3), order(1), order(2)] }),
      });

      const records = await collection.list(
        caller,
        new PaginatedFilter({
          conditionTree: leaf('customerId', 'Equal', 'c1'),
          sort: new Sort({ field: 'total', ascending: false }),
        }),
        new Projection('orderId', 'total'),
      );

      expect(records.map(r => r.total)).toEqual([3, 2, 1]);
    });

    it('sorts null and missing values last when ascending', async () => {
      const { collection } = buildCollection(buildSimpleModel(), {
        Scan: () => ({ Items: [{ id: 'a' }, { id: 'b', age: 2 }, { id: 'c', age: 1 }] }),
      });

      const records = await collection.list(
        caller,
        new PaginatedFilter({ sort: new Sort({ field: 'age', ascending: true }) }),
        new Projection('id', 'age'),
      );

      expect(records.map(r => r.id)).toEqual(['c', 'b', 'a']);
    });
  });

  describe('pagination', () => {
    it('limits the items read when nothing filters them', async () => {
      const { collection, client } = buildCollection(buildModel(), {
        Query: () => ({ Items: [order(1), order(2)] }),
      });

      const records = await collection.list(
        caller,
        new PaginatedFilter({
          conditionTree: leaf('customerId', 'Equal', 'c1'),
          page: { limit: 2, skip: 0 } as never,
        }),
        new Projection('orderId'),
      );

      expect(records).toHaveLength(2);
      expect(client.calls('Query')[0].Limit).toBe(2);
    });

    it('skips records and follows LastEvaluatedKey until the page is full', async () => {
      const { collection, client } = buildCollection(buildModel(), {
        Query: [
          { Items: [order(1), order(2)], LastEvaluatedKey: { customerId: 'c1', orderId: 'o2' } },
          { Items: [order(3), order(4)], LastEvaluatedKey: { customerId: 'c1', orderId: 'o4' } },
          { Items: [order(5)] },
        ],
      });

      const records = await collection.list(
        caller,
        new PaginatedFilter({
          conditionTree: and(plain('customerId', 'Equal', 'c1'), plain('status', 'Equal', 'paid')),
          page: { limit: 2, skip: 3 } as never,
        }),
        new Projection('orderId'),
      );

      expect(records.map(r => r.orderId)).toEqual(['o4', 'o5']);
      expect(client.calls('Query')[1]).toMatchObject({
        ExclusiveStartKey: { customerId: 'c1', orderId: 'o2' },
      });
    });

    it('resumes from a cached key when jumping to a deeper page', async () => {
      const first = buildCollection(buildModel(), {
        Query: [
          { Items: [order(1), order(2)], LastEvaluatedKey: { customerId: 'c1', orderId: 'o2' } },
          { Items: [order(3), order(4)] },
        ],
      });
      const filter = (skip: number) =>
        new PaginatedFilter({
          conditionTree: and(plain('customerId', 'Equal', 'c1'), plain('status', 'Equal', 'paid')),
          page: { limit: 2, skip } as never,
        });

      await first.collection.list(caller, filter(0), new Projection('orderId'));
      first.client.send.mockClear();
      await first.collection.list(caller, filter(2), new Projection('orderId'));

      expect(first.client.calls('Query')[0]).toMatchObject({
        ExclusiveStartKey: { customerId: 'c1', orderId: 'o2' },
      });
    });

    it('refuses an offset deeper than the maximum', async () => {
      const { collection } = buildCollection(buildModel(), {}, { maxOffset: 10 });

      await expect(
        collection.list(
          caller,
          new PaginatedFilter({
            conditionTree: leaf('customerId', 'Equal', 'c1'),
            page: { limit: 5, skip: 11 } as never,
          }),
          new Projection('orderId'),
        ),
      ).rejects.toThrow(
        'Offset 11 exceeds the maximum allowed offset of 10. Narrow the results with filters.',
      );
    });

    it('returns every matching record when no page is requested', async () => {
      const { collection } = buildCollection(buildModel(), {
        Query: [
          { Items: [order(1)], LastEvaluatedKey: { customerId: 'c1', orderId: 'o1' } },
          { Items: [order(2)] },
        ],
      });

      const records = await collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('customerId', 'Equal', 'c1') }),
        new Projection('orderId'),
      );

      expect(records).toHaveLength(2);
    });
  });

  describe('records', () => {
    it('serialises sets, nested maps and dates', async () => {
      const { collection } = buildCollection(
        buildSimpleModel({
          schema: {
            id: { type: 'string' },
            tags: { type: 'array' },
            'address->city': { type: 'string' },
          },
        }),
        {
          Scan: () => ({
            Items: [{ id: 'u1', tags: new Set(['a']), address: { city: 'Paris', zip: '75' } }],
          }),
        },
      );

      const records = await collection.list(
        caller,
        new PaginatedFilter({}),
        new Projection('id', 'tags', 'address->city'),
      );

      expect(records).toEqual([{ id: 'u1', tags: ['a'], 'address->city': 'Paris' }]);
    });

    it('fetches the top-level attribute of a nested projection, with the key', async () => {
      const { collection, client } = buildCollection(
        buildSimpleModel({
          schema: { id: { type: 'string' }, 'address->city': { type: 'string' } },
        }),
        { Scan: () => ({ Items: [] }) },
      );

      await collection.list(caller, new PaginatedFilter({}), new Projection('address->city'));

      expect(client.calls('Scan')[0]).toMatchObject({
        ProjectionExpression: '#n0, #n1',
        ExpressionAttributeNames: { '#n0': 'address', '#n1': 'id' },
      });
    });
  });

  describe('single-table entity', () => {
    it('restricts reads to the entity discriminator', async () => {
      const { collection, client } = buildCollection(
        buildModel({ entity: { attribute: 'entityType', value: 'ORDER' } }),
        { Query: () => ({ Items: [] }) },
      );

      await collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('customerId', 'Equal', 'c1') }),
        new Projection('orderId'),
      );

      expect(client.calls('Query')[0]).toMatchObject({
        FilterExpression: '#n1 = :v1',
        ExpressionAttributeNames: expect.objectContaining({ '#n1': 'entityType' }),
        ExpressionAttributeValues: { ':v0': 'c1', ':v1': 'ORDER' },
      });
    });
  });

  describe('observability', () => {
    it('logs the generated expressions when asked', async () => {
      const { collection, logger } = buildCollection(
        buildModel(),
        { Query: () => ({ Items: [] }) },
        { logQueries: true },
      );

      await collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('customerId', 'Equal', 'c1') }),
        new Projection('orderId'),
      );

      expect(logger).toHaveBeenCalledWith(
        'Info',
        '[DynamoDB Query] orders.query: KeyCondition=#n0 = :v0 | Filter=- | Index=table',
      );
    });

    it('logs the consumed capacity when asked', async () => {
      const { collection, logger, client } = buildCollection(
        buildModel(),
        { Query: () => ({ Items: [], ConsumedCapacity: { CapacityUnits: 1.5 } }) },
        { logConsumedCapacity: true },
      );

      await collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('customerId', 'Equal', 'c1') }),
        new Projection('orderId'),
      );

      expect(client.calls('Query')[0].ReturnConsumedCapacity).toBe('TOTAL');
      expect(logger).toHaveBeenCalledWith('Info', '[DynamoDB Capacity] orders.query: 1.5 units');
    });
  });
});

describe('DynamoDBCollection.list with long lists of values', () => {
  const values = Array.from({ length: 250 }, (_, i) => `v${i}`);

  it('evaluates a long In list on the returned items instead of overflowing the expression', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), {
      Scan: () => ({
        Items: [
          { id: 'a', name: 'v7' },
          { id: 'b', name: 'other' },
        ],
      }),
    });

    const records = await collection.list(
      caller,
      new PaginatedFilter({ conditionTree: leaf('name', 'In', values) }),
      new Projection('id'),
    );

    expect(records).toEqual([{ id: 'a' }]);
    expect(client.calls('Scan')[0].FilterExpression).toBeUndefined();
  });

  it('still reads a long list of keys with BatchGetItem', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), {
      BatchGet: () => ({ Responses: { Users: [] } }),
    });

    await collection.list(
      caller,
      new PaginatedFilter({ conditionTree: leaf('id', 'In', values) }),
      new Projection('id'),
    );

    expect(client.calls('BatchGet').map(call => call.RequestItems.Users.Keys.length)).toEqual([
      100, 100, 50,
    ]);
  });
});
