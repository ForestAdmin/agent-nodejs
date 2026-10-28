import { Aggregation, Filter, PaginatedFilter, Projection } from '@forestadmin/datasource-toolkit';

import { buildCollection } from './collection-helpers';
import { buildModel, buildSimpleModel, leaf } from './helpers';

const caller = { timezone: 'UTC' } as never;
const order = (customerId: string, n: number) => ({ customerId, orderId: `o${n}`, total: n });

describe('an In on the partition key', () => {
  it('reads each partition with a Query and merges the items', async () => {
    const { collection, client } = buildCollection(buildModel(), {
      Query: (input: any) =>
        input.ExpressionAttributeValues[':v0'] === 'c1'
          ? { Items: [order('c1', 1), order('c1', 2)] }
          : { Items: [order('c2', 3)] },
    });

    const records = await collection.list(
      caller,
      new PaginatedFilter({
        conditionTree: leaf('customerId', 'In', ['c1', 'c2']),
        page: { skip: 1, limit: 2 } as never,
      }),
      new Projection('orderId'),
    );

    expect(records).toEqual([{ orderId: 'o2' }, { orderId: 'o3' }]);
    expect(client.calls('Query').map(call => call.ExpressionAttributeValues[':v0'])).toEqual([
      'c1',
      'c2',
    ]);
    expect(client.calls('Scan')).toHaveLength(0);
  });

  it('counts the partitions without reading items', async () => {
    const { collection, client } = buildCollection(buildModel(), {
      Query: (input: any) => ({ Count: input.ExpressionAttributeValues[':v0'] === 'c1' ? 4 : 3 }),
    });

    const result = await collection.aggregate(
      caller,
      new Filter({ conditionTree: leaf('customerId', 'In', ['c1', 'c2']) }),
      new Aggregation({ operation: 'Count' }),
    );

    expect(result).toEqual([{ value: 7, group: {} }]);
    expect(client.calls('Query').every(call => call.Select === 'COUNT')).toBe(true);
  });

  it('aggregates the items of every partition', async () => {
    const { collection } = buildCollection(buildModel(), {
      Query: (input: any) => ({
        Items:
          input.ExpressionAttributeValues[':v0'] === 'c1' ? [order('c1', 1)] : [order('c2', 5)],
      }),
    });

    const result = await collection.aggregate(
      caller,
      new Filter({ conditionTree: leaf('customerId', 'In', ['c1', 'c2']) }),
      new Aggregation({ operation: 'Sum', field: 'total' }),
    );

    expect(result).toEqual([{ value: 6, group: {} }]);
  });
});

describe('scan warnings', () => {
  const scanning = () => ({ Scan: () => ({ Items: [] }) });

  it('does not warn for the first page of a collection read without a filter', async () => {
    const { collection, logger } = buildCollection(buildSimpleModel(), scanning());

    await collection.list(
      caller,
      new PaginatedFilter({ page: { skip: 0, limit: 15 } as never }),
      new Projection('id'),
    );

    expect(logger).not.toHaveBeenCalledWith('Warn', expect.anything());
  });

  it('still refuses that page under a deny policy only when it is deep', async () => {
    const { collection } = buildCollection(buildSimpleModel({ scanPolicy: 'deny' }), scanning());

    await expect(
      collection.list(
        caller,
        new PaginatedFilter({ page: { skip: 0, limit: 15 } as never }),
        new Projection('id'),
      ),
    ).resolves.toEqual([]);
    await expect(
      collection.list(
        caller,
        new PaginatedFilter({ page: { skip: 5000, limit: 15 } as never }),
        new Projection('id'),
      ),
    ).rejects.toThrow("refused by scanPolicy 'deny'");
  });

  it('warns once a minute for the same scan', async () => {
    let now = 0;
    const { collection, logger } = buildCollection(buildSimpleModel(), scanning(), {
      now: () => now,
    });
    const list = () =>
      collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('name', 'Equal', 'a') }),
        new Projection('id'),
      );
    const warnings = () => logger.mock.calls.filter(([level]) => level === 'Warn').length;

    await list();
    now = 59000;
    await list();
    expect(warnings()).toBe(1);

    now = 61000;
    await list();
    expect(warnings()).toBe(2);
  });
});
