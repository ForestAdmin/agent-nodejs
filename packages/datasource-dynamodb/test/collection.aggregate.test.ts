import { Aggregation, Filter } from '@forestadmin/datasource-toolkit';

import { buildCollection } from './collection-helpers';
import { and, buildModel, buildSimpleModel, leaf, plain } from './helpers';

const caller = { timezone: 'UTC' } as never;
const aggregation = (plainAggregation: ConstructorParameters<typeof Aggregation>[0]) =>
  new Aggregation(plainAggregation);

describe('DynamoDBCollection.aggregate', () => {
  describe('count', () => {
    it('counts a query with Select COUNT, reading no item', async () => {
      const { collection, client } = buildCollection(buildModel(), {
        Query: [
          { Count: 40, LastEvaluatedKey: { customerId: 'c1', orderId: 'o40' } },
          { Count: 2 },
        ],
      });

      const result = await collection.aggregate(
        caller,
        new Filter({ conditionTree: leaf('customerId', 'Equal', 'c1') }),
        aggregation({ operation: 'Count' }),
      );

      expect(result).toEqual([{ value: 42, group: {} }]);
      expect(client.calls('Query')[0]).toMatchObject({ Select: 'COUNT' });
      expect(client.calls('Query')[1]).toMatchObject({
        ExclusiveStartKey: { customerId: 'c1', orderId: 'o40' },
      });
    });

    it('counts a table with a parallel Scan and sums the segments', async () => {
      const { collection, client } = buildCollection(
        buildSimpleModel(),
        { Scan: (input: any) => ({ Count: input.Segment + 1 }) },
        { scanConcurrency: 3 },
      );

      const result = await collection.aggregate(
        caller,
        new Filter({}),
        aggregation({ operation: 'Count' }),
      );

      expect(result).toEqual([{ value: 1 + 2 + 3, group: {} }]);
      expect(client.calls('Scan').map(c => [c.Segment, c.TotalSegments])).toEqual([
        [0, 3],
        [1, 3],
        [2, 3],
      ]);
      expect(client.calls('Scan')[0]).toMatchObject({ Select: 'COUNT' });
    });

    it('does not use segments for a single-segment scan', async () => {
      const { collection, client } = buildCollection(
        buildSimpleModel(),
        { Scan: () => ({ Count: 7 }) },
        { scanConcurrency: 1 },
      );

      await collection.aggregate(caller, new Filter({}), aggregation({ operation: 'Count' }));

      expect(client.calls('Scan')[0].Segment).toBeUndefined();
      expect(client.calls('Scan')[0].TotalSegments).toBeUndefined();
    });

    it('pushes the filter into the counting request', async () => {
      const { collection, client } = buildCollection(
        buildSimpleModel(),
        { Scan: () => ({ Count: 1 }) },
        { scanConcurrency: 1 },
      );

      await collection.aggregate(
        caller,
        new Filter({ conditionTree: leaf('age', 'GreaterThan', 3) }),
        aggregation({ operation: 'Count' }),
      );

      expect(client.calls('Scan')[0]).toMatchObject({
        FilterExpression: '#n0 > :v0',
        Select: 'COUNT',
      });
    });

    it('reads the items when part of the filter cannot be pushed down', async () => {
      const { collection, client } = buildCollection(
        buildSimpleModel(),
        {
          Scan: () => ({
            Items: [
              { id: 'a', name: 'xc' },
              { id: 'b', name: 'xd' },
            ],
          }),
        },
        { scanConcurrency: 1 },
      );

      const result = await collection.aggregate(
        caller,
        new Filter({ conditionTree: leaf('name', 'EndsWith', 'c') }),
        aggregation({ operation: 'Count' }),
      );

      expect(result).toEqual([{ value: 1, group: {} }]);
      expect(client.calls('Scan')[0].Select).toBeUndefined();
    });

    it('answers an unfiltered count from the table description when approximate counts are on', async () => {
      const { collection, client } = buildCollection(
        buildSimpleModel(),
        { DescribeTable: () => ({ Table: { ItemCount: 1234 } }) },
        { approximateCount: true },
      );

      const result = await collection.aggregate(
        caller,
        new Filter({}),
        aggregation({ operation: 'Count' }),
      );

      expect(result).toEqual([{ value: 1234, group: {} }]);
      expect(client.calls('Scan')).toHaveLength(0);
    });

    it('still counts exactly a filtered request when approximate counts are on', async () => {
      const { collection } = buildCollection(
        buildSimpleModel(),
        { Scan: () => ({ Count: 3 }) },
        { approximateCount: true, scanConcurrency: 1 },
      );

      const result = await collection.aggregate(
        caller,
        new Filter({ conditionTree: leaf('age', 'Equal', 3) }),
        aggregation({ operation: 'Count' }),
      );

      expect(result).toEqual([{ value: 3, group: {} }]);
    });
  });

  describe('reducing operations', () => {
    it('reads only the attributes it needs and reduces them', async () => {
      const { collection, client } = buildCollection(
        buildModel(),
        {
          Query: () => ({
            Items: [
              { total: 10, status: 'paid' },
              { total: 5, status: 'paid' },
              { total: 1, status: 'open' },
            ],
          }),
        },
        { scanConcurrency: 1 },
      );

      const result = await collection.aggregate(
        caller,
        new Filter({ conditionTree: leaf('customerId', 'Equal', 'c1') }),
        aggregation({ operation: 'Sum', field: 'total', groups: [{ field: 'status' }] }),
      );

      expect(result).toEqual([
        { value: 15, group: { status: 'paid' } },
        { value: 1, group: { status: 'open' } },
      ]);
      expect(client.calls('Query')[0]).toMatchObject({
        ProjectionExpression: '#n1, #n2',
        ExpressionAttributeNames: { '#n0': 'customerId', '#n1': 'total', '#n2': 'status' },
      });
    });

    it('groups on several fields', async () => {
      const { collection } = buildCollection(
        buildSimpleModel(),
        {
          Scan: () => ({
            Items: [
              { a: 1, b: 'x' },
              { a: 1, b: 'x' },
              { a: 2, b: 'x' },
            ],
          }),
        },
        { scanConcurrency: 1 },
      );

      const result = await collection.aggregate(
        caller,
        new Filter({}),
        aggregation({ operation: 'Count', groups: [{ field: 'a' }, { field: 'b' }] }),
      );

      expect(result).toEqual([
        { value: 2, group: { a: 1, b: 'x' } },
        { value: 1, group: { a: 2, b: 'x' } },
      ]);
    });

    it('groups by a date part in the caller timezone', async () => {
      const { collection } = buildCollection(
        buildModel(),
        { Scan: () => ({ Items: [{ createdAt: '2024-01-20T23:30:00Z' }] }) },
        { scanConcurrency: 1 },
      );

      const result = await collection.aggregate(
        { timezone: 'Asia/Tokyo' } as never,
        new Filter({}),
        aggregation({ operation: 'Count', groups: [{ field: 'createdAt', operation: 'Day' }] }),
      );

      expect(result).toEqual([{ value: 1, group: { createdAt: '2024-01-21' } }]);
    });

    it('applies the limit to the groups', async () => {
      const { collection } = buildCollection(
        buildSimpleModel(),
        { Scan: () => ({ Items: [{ a: 1 }, { a: 2 }, { a: 2 }, { a: 3 }, { a: 3 }, { a: 3 }] }) },
        { scanConcurrency: 1 },
      );

      const result = await collection.aggregate(
        caller,
        new Filter({}),
        aggregation({ operation: 'Count', groups: [{ field: 'a' }] }),
        2,
      );

      expect(result.map(r => r.group.a)).toEqual([3, 2]);
    });

    it('merges the segments of a parallel scan', async () => {
      const { collection, client } = buildCollection(
        buildSimpleModel(),
        {
          Scan: (input: any) => ({
            Items: [{ age: input.Segment + 1 }],
          }),
        },
        { scanConcurrency: 2 },
      );

      const result = await collection.aggregate(
        caller,
        new Filter({}),
        aggregation({ operation: 'Sum', field: 'age' }),
      );

      expect(result).toEqual([{ value: 3, group: {} }]);
      expect(client.calls('Scan')).toHaveLength(2);
    });

    it('follows LastEvaluatedKey inside each segment', async () => {
      const { collection, client } = buildCollection(
        buildSimpleModel(),
        {
          Scan: [{ Items: [{ age: 1 }], LastEvaluatedKey: { id: 'a' } }, { Items: [{ age: 2 }] }],
        },
        { scanConcurrency: 1 },
      );

      const result = await collection.aggregate(
        caller,
        new Filter({}),
        aggregation({ operation: 'Sum', field: 'age' }),
      );

      expect(result).toEqual([{ value: 3, group: {} }]);
      expect(client.calls('Scan')[1]).toMatchObject({ ExclusiveStartKey: { id: 'a' } });
    });

    it('stops reading beyond maxScannedItems', async () => {
      const { collection } = buildCollection(
        buildSimpleModel({ maxScannedItems: 2 }),
        {
          Scan: () => ({
            Items: [{ age: 1 }, { age: 1 }],
            ScannedCount: 2,
            LastEvaluatedKey: { id: 'a' },
          }),
        },
        { scanConcurrency: 1 },
      );

      await expect(
        collection.aggregate(
          caller,
          new Filter({}),
          aggregation({ operation: 'Sum', field: 'age' }),
        ),
      ).rejects.toThrow("Scan on table 'Users' stopped after 4 items: maxScannedItems is 2");
    });

    it('stops the other segments from reading on when one fails', async () => {
      const { collection, client } = buildCollection(
        buildSimpleModel(),
        {
          Scan: (input: any) => {
            if (input.Segment === 0) throw new Error('boom');

            return { Items: [{ age: 1 }], LastEvaluatedKey: { id: 'a' } };
          },
        },
        { scanConcurrency: 2 },
      );

      await expect(
        collection.aggregate(
          caller,
          new Filter({}),
          aggregation({ operation: 'Sum', field: 'age' }),
        ),
      ).rejects.toThrow("Failed to aggregate records of 'users': boom");
      await new Promise(resolve => {
        setImmediate(resolve);
      });

      expect(client.calls('Scan').filter(call => call.Segment === 1).length).toBeLessThanOrEqual(2);
    });

    it('refuses to scan under a deny policy', async () => {
      const { collection } = buildCollection(buildSimpleModel({ scanPolicy: 'deny' }), {});

      await expect(
        collection.aggregate(caller, new Filter({}), aggregation({ operation: 'Count' })),
      ).rejects.toThrow("Scan on table 'Users' refused by scanPolicy 'deny'");
    });

    it('wraps a failure with the collection name', async () => {
      const { collection } = buildCollection(buildSimpleModel(), {
        Scan: () => {
          throw new Error('boom');
        },
      });

      await expect(
        collection.aggregate(caller, new Filter({}), aggregation({ operation: 'Count' })),
      ).rejects.toThrow("Failed to aggregate records of 'users': boom");
    });
  });

  describe('result cache', () => {
    it('serves the same chart from memory within the time to live', async () => {
      let now = 1000;
      const { collection, client } = buildCollection(
        buildSimpleModel(),
        { Scan: () => ({ Count: 5 }) },
        { chartCacheTtlMs: 1000, scanConcurrency: 1, now: () => now },
      );
      const run = () =>
        collection.aggregate(caller, new Filter({}), aggregation({ operation: 'Count' }));

      await run();
      now += 999;
      const second = await run();

      expect(second).toEqual([{ value: 5, group: {} }]);
      expect(client.calls('Scan')).toHaveLength(1);
    });

    it('reads again once the time to live has passed', async () => {
      let now = 1000;
      const { collection, client } = buildCollection(
        buildSimpleModel(),
        { Scan: () => ({ Count: 5 }) },
        { chartCacheTtlMs: 1000, scanConcurrency: 1, now: () => now },
      );
      const run = () =>
        collection.aggregate(caller, new Filter({}), aggregation({ operation: 'Count' }));

      await run();
      now += 1001;
      await run();

      expect(client.calls('Scan')).toHaveLength(2);
    });

    it('does not mix charts of different filters', async () => {
      const { collection, client } = buildCollection(
        buildSimpleModel(),
        { Scan: () => ({ Count: 5 }) },
        { chartCacheTtlMs: 1000, scanConcurrency: 1 },
      );

      await collection.aggregate(
        caller,
        new Filter({ conditionTree: leaf('age', 'Equal', 1) }),
        aggregation({ operation: 'Count' }),
      );
      await collection.aggregate(
        caller,
        new Filter({ conditionTree: leaf('age', 'Equal', 2) }),
        aggregation({ operation: 'Count' }),
      );

      expect(client.calls('Scan')).toHaveLength(2);
    });

    it('remembers at most 100 charts, dropping the oldest', async () => {
      const { collection, client } = buildCollection(
        buildSimpleModel(),
        { Scan: () => ({ Count: 5 }) },
        { chartCacheTtlMs: 60000, scanConcurrency: 1 },
      );
      const run = (age: number) =>
        collection.aggregate(
          caller,
          new Filter({ conditionTree: leaf('age', 'Equal', age) }),
          aggregation({ operation: 'Count' }),
        );

      for (let age = 0; age <= 100; age += 1) {
        // eslint-disable-next-line no-await-in-loop
        await run(age);
      }
      client.send.mockClear();

      await run(100);
      await run(0);

      expect(client.calls('Scan')).toHaveLength(1);
    });

    it('is off when the time to live is zero', async () => {
      const { collection, client } = buildCollection(
        buildSimpleModel(),
        { Scan: () => ({ Count: 5 }) },
        { chartCacheTtlMs: 0, scanConcurrency: 1 },
      );
      const run = () =>
        collection.aggregate(caller, new Filter({}), aggregation({ operation: 'Count' }));

      await run();
      await run();

      expect(client.calls('Scan')).toHaveLength(2);
    });
  });

  it('uses the access path of the filter for the aggregation', async () => {
    const { collection, client } = buildCollection(
      buildModel(),
      { Query: () => ({ Count: 2 }) },
      { scanConcurrency: 1 },
    );

    await collection.aggregate(
      caller,
      new Filter({
        conditionTree: and(plain('customerId', 'Equal', 'c1'), plain('orderId', 'StartsWith', 'o')),
      }),
      aggregation({ operation: 'Count' }),
    );

    expect(client.calls('Query')[0]).toMatchObject({
      KeyConditionExpression: '#n0 = :v0 AND begins_with(#n1, :v1)',
      Select: 'COUNT',
    });
  });
});
