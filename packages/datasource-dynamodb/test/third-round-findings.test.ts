import { PaginatedFilter, Projection, Sort } from '@forestadmin/datasource-toolkit';

import { buildCollection } from './collection-helpers';
import { buildSimpleModel, leaf } from './helpers';

const caller = { timezone: 'UTC' } as never;

describe('maxScannedItems on key lookups', () => {
  it('counts the keys read by BatchGetItem', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `u${i}`);
    const { collection } = buildCollection(
      buildSimpleModel(),
      {
        BatchGet: (input: any) => ({
          Responses: {
            Users: (input.RequestItems.Users.Keys as Array<{ id: string }>).map(key => ({
              id: key.id,
            })),
          },
        }),
      },
      { maxScannedItems: 50 },
    );

    await expect(
      collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('id', 'In', ids) }),
        new Projection('id'),
      ),
    ).rejects.toThrow(/maxScannedItems is 50/);
  });

  it('reads the keys of a lookup that fits the limit', async () => {
    const { collection } = buildCollection(
      buildSimpleModel(),
      { BatchGet: () => ({ Responses: { Users: [{ id: 'u1' }, { id: 'u2' }] } }) },
      { maxScannedItems: 50 },
    );

    const records = await collection.list(
      caller,
      new PaginatedFilter({ conditionTree: leaf('id', 'In', ['u1', 'u2']) }),
      new Projection('id'),
    );

    expect(records).toEqual([{ id: 'u1' }, { id: 'u2' }]);
  });
});

describe('maxOffset on reads that sort in memory', () => {
  it('refuses a skip beyond the limit, as the paged read does', async () => {
    const { collection, client } = buildCollection(
      buildSimpleModel(),
      { Scan: () => ({ Items: [{ id: 'u1', name: 'a' }] }) },
      { maxOffset: 100, scanConcurrency: 1 },
    );

    await expect(
      collection.list(
        caller,
        new PaginatedFilter({
          sort: new Sort({ field: 'name', ascending: true }),
          page: { skip: 200, limit: 15 } as never,
        }),
        new Projection('id'),
      ),
    ).rejects.toThrow('Offset 200 exceeds the maximum allowed offset of 100');
    expect(client.calls('Scan')).toHaveLength(0);
  });
});

describe('binary attributes', () => {
  it('filters them on the returned items, not in DynamoDB', async () => {
    const model = buildSimpleModel({
      schema: { id: { type: 'string' }, blob: { type: 'binary' } },
    });
    const { collection, client } = buildCollection(
      model,
      {
        Scan: () => ({
          Items: [
            { id: 'u1', blob: Uint8Array.from([1, 2, 3]) },
            { id: 'u2', blob: Uint8Array.from([9]) },
          ],
        }),
      },
      { scanConcurrency: 1 },
    );

    const records = await collection.list(
      caller,
      new PaginatedFilter({ conditionTree: leaf('blob', 'Equal', 'AQID') }),
      new Projection('id', 'blob'),
    );

    expect(records).toEqual([{ id: 'u1', blob: 'AQID' }]);
    expect(client.calls('Scan')[0].FilterExpression).toBeUndefined();
  });
});
