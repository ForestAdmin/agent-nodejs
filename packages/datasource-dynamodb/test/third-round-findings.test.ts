import { Filter, PaginatedFilter, Projection, Sort } from '@forestadmin/datasource-toolkit';

import { buildCollection } from './collection-helpers';
import { and, buildModel, buildSimpleModel, leaf } from './helpers';

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
      { maxOffset: 100, scanConcurrency: 1, inMemoryProcessing: true },
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

describe('writing binary attributes', () => {
  const model = () =>
    buildSimpleModel({ schema: { id: { type: 'string' }, blob: { type: 'binary' } } });

  it('stores the bytes of the base64 text on create and returns the text', async () => {
    const { collection, client } = buildCollection(model(), { Put: () => ({}) });

    const [created] = await collection.create(caller, [{ id: 'u1', blob: 'AQID' }]);

    expect(Array.from(client.calls('Put')[0].Item.blob as Uint8Array)).toEqual([1, 2, 3]);
    expect(created.blob).toBe('AQID');
  });

  it('stores the bytes of the base64 text on update', async () => {
    const { collection, client } = buildCollection(model(), { Update: () => ({}) });

    await collection.update(caller, new Filter({ conditionTree: leaf('id', 'Equal', 'u1') }), {
      blob: 'AQID',
    });

    const [value] = Object.values(client.calls('Update')[0].ExpressionAttributeValues);
    expect(Array.from(value as Uint8Array)).toEqual([1, 2, 3]);
  });

  it('keeps a null binary as null', async () => {
    const { collection, client } = buildCollection(model(), { Update: () => ({}) });

    await collection.update(caller, new Filter({ conditionTree: leaf('id', 'Equal', 'u1') }), {
      blob: null,
    });

    expect(Object.values(client.calls('Update')[0].ExpressionAttributeValues)).toContain(null);
  });
});

describe('a nested entity discriminator', () => {
  const model = () => buildModel({ entity: { attribute: 'meta@@@type', value: 'ORDER' } });

  it('is stamped under its path, not under a literal key', async () => {
    const { collection, client } = buildCollection(model(), { Put: () => ({}) });

    const [created] = await collection.create(caller, [{ customerId: 'c1', orderId: 'o1' }]);
    const { Item } = client.calls('Put')[0];

    expect(Item.meta).toEqual({ type: 'ORDER' });
    expect(Object.keys(Item)).not.toContain('meta@@@type');
    expect(created['meta@@@type']).toBe('ORDER');
  });

  it('refuses another value supplied for it', async () => {
    const { collection, client } = buildCollection(model(), { Put: () => ({}) });

    await expect(
      collection.create(caller, [{ customerId: 'c1', orderId: 'o1', 'meta@@@type': 'INVOICE' }]),
    ).rejects.toThrow("The attribute 'meta@@@type' of 'orders' must be 'ORDER'");
    expect(client.calls('Put')).toHaveLength(0);
  });
});

describe('a nested entity discriminator left out of the schema', () => {
  it('still matches the items of the entity when they are read by key', async () => {
    const { collection } = buildCollection(
      buildModel({ entity: { attribute: 'meta@@@type', value: 'ORDER' } }),
      {
        BatchGet: () => ({
          Responses: {
            Orders: [
              { customerId: 'c1', orderId: 'o1', meta: { type: 'ORDER' } },
              { customerId: 'c1', orderId: 'o2', meta: { type: 'INVOICE' } },
            ],
          },
        }),
      },
    );

    const records = await collection.list(
      caller,
      new PaginatedFilter({
        conditionTree: and(leaf('customerId', 'Equal', 'c1'), leaf('orderId', 'In', ['o1', 'o2'])),
      }),
      new Projection('orderId'),
    );

    expect(records).toEqual([{ orderId: 'o1' }]);
  });
});
