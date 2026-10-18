import { Aggregation, Filter } from '@forestadmin/datasource-toolkit';

import { buildCollection } from './collection-helpers';
import { and, buildModel, buildSimpleModel, leaf, plain } from './helpers';

const caller = { timezone: 'UTC' } as never;
const conditional = () =>
  Object.assign(new Error('The conditional request failed'), {
    name: 'ConditionalCheckFailedException',
  });

describe('DynamoDBCollection.create', () => {
  it('puts each record unless it would overwrite an existing item', async () => {
    const { collection, client } = buildCollection(buildModel(), { Put: () => ({}) });

    const created = await collection.create(caller, [
      { customerId: 'c1', orderId: 'o1', total: 5, 'address->city': 'Paris' },
    ]);

    expect(created).toEqual([
      { customerId: 'c1', orderId: 'o1', total: 5, 'address->city': 'Paris' },
    ]);
    expect(client.calls('Put')[0]).toEqual({
      TableName: 'Orders',
      Item: { customerId: 'c1', orderId: 'o1', total: 5, address: { city: 'Paris' } },
      ConditionExpression: 'attribute_not_exists(#k0)',
      ExpressionAttributeNames: { '#k0': 'customerId' },
    });
  });

  it('generates a partition key for a string key left empty', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), { Put: () => ({}) });

    const [created] = await collection.create(caller, [{ name: 'Bob' }]);

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(client.calls('Put')[0].Item.id).toBe(created.id);
  });

  it('generates a sort key for a string key left empty', async () => {
    const { collection, client } = buildCollection(buildModel(), { Put: () => ({}) });

    const [created] = await collection.create(caller, [{ customerId: 'c1' }]);

    expect(created.orderId).toMatch(/^[0-9a-f-]{36}$/);
    expect(client.calls('Put')[0].Item).toMatchObject({
      customerId: 'c1',
      orderId: created.orderId,
    });
  });

  it('prefixes a generated sort key with the entity prefix', async () => {
    const { collection } = buildCollection(buildModel({ entity: { sortKeyPrefix: 'ORDER#' } }), {
      Put: () => ({}),
    });

    const [created] = await collection.create(caller, [{ customerId: 'c1', orderId: '' }]);

    expect(created.orderId).toMatch(/^ORDER#[0-9a-f-]{36}$/);
  });

  it('refuses a numeric sort key left empty', async () => {
    const { collection, client } = buildCollection(
      buildModel({
        sortKey: { name: 'orderId', type: 'N' },
        schema: { orderId: { type: 'number' } },
      }),
      { Put: () => ({}) },
    );

    await expect(collection.create(caller, [{ customerId: 'c1' }])).rejects.toThrow(
      "The sort key 'orderId' is required to create a record in 'orders'",
    );
    expect(client.calls('Put')).toHaveLength(0);
  });

  it('treats an empty string key as missing', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), { Put: () => ({}) });

    const [created] = await collection.create(caller, [{ id: '', name: 'Bob' }]);

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(client.calls('Put')[0].Item.id).toBe(created.id);
  });

  it('refuses a numeric partition key left empty', async () => {
    const { collection } = buildCollection(
      buildSimpleModel({
        partitionKey: { name: 'id', type: 'N' },
        schema: { id: { type: 'number' } },
      }),
      { Put: () => ({}) },
    );

    await expect(collection.create(caller, [{}])).rejects.toThrow(
      "The partition key 'id' is required to create a record in 'users'",
    );
  });

  it('reports an existing item as a validation error', async () => {
    const { collection } = buildCollection(buildModel(), {
      Put: () => {
        throw conditional();
      },
    });

    await expect(collection.create(caller, [{ customerId: 'c1', orderId: 'o1' }])).rejects.toThrow(
      "A record with the same key already exists in 'orders'",
    );
  });

  it('stamps the entity discriminator', async () => {
    const { collection, client } = buildCollection(
      buildModel({ entity: { attribute: 'entityType', value: 'ORDER' } }),
      { Put: () => ({}) },
    );

    await collection.create(caller, [{ customerId: 'c1', orderId: 'o1' }]);

    expect(client.calls('Put')[0].Item.entityType).toBe('ORDER');
  });

  it('refuses a sort key outside the entity prefix', async () => {
    const { collection } = buildCollection(buildModel({ entity: { sortKeyPrefix: 'ORDER#' } }), {
      Put: () => ({}),
    });

    await expect(
      collection.create(caller, [{ customerId: 'c1', orderId: 'INVOICE#1' }]),
    ).rejects.toThrow("The sort key 'orderId' of 'orders' must start with 'ORDER#'");
  });

  it('forgets the cached pages and charts of the table', async () => {
    const { collection, client } = buildCollection(
      buildModel(),
      { Put: () => ({}), Scan: () => ({ Items: [{ total: 1 }] }) },
      { chartCacheTtlMs: 60000, scanConcurrency: 4 },
    );
    const aggregation = new Aggregation({ operation: 'Sum', field: 'total' });

    await collection.aggregate(caller, new Filter({}), aggregation);
    await collection.create(caller, [{ customerId: 'c1', orderId: 'o1' }]);
    await collection.aggregate(caller, new Filter({}), aggregation);

    expect(client.calls('Scan')).toHaveLength(8);
  });
});

describe('DynamoDBCollection.update', () => {
  it('updates by key without reading when the filter pins the key', async () => {
    const { collection, client } = buildCollection(buildModel(), { Update: () => ({}) });

    await collection.update(
      caller,
      new Filter({
        conditionTree: and(plain('customerId', 'Equal', 'c1'), plain('orderId', 'Equal', 'o1')),
      }),
      { total: 9, status: 'paid' },
    );

    expect(client.calls('Update')).toEqual([
      {
        TableName: 'Orders',
        Key: { customerId: 'c1', orderId: 'o1' },
        UpdateExpression: 'SET #n0 = :v0, #n1 = :v1',
        ConditionExpression: 'attribute_exists(#k0)',
        ExpressionAttributeNames: { '#n0': 'total', '#n1': 'status', '#k0': 'customerId' },
        ExpressionAttributeValues: { ':v0': 9, ':v1': 'paid' },
      },
    ]);
    expect(client.calls('Scan')).toHaveLength(0);
    expect(client.calls('Query')).toHaveLength(0);
  });

  it('sets a nested attribute through its document path', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), { Update: () => ({}) });

    await collection.update(caller, new Filter({ conditionTree: leaf('id', 'Equal', 'u1') }), {
      'address->city': 'Lyon',
    });

    expect(client.calls('Update')[0]).toMatchObject({
      UpdateExpression: 'SET #n0.#n1 = :v0',
      ExpressionAttributeNames: expect.objectContaining({ '#n0': 'address', '#n1': 'city' }),
    });
  });

  it('stores a null as an explicit NULL', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), { Update: () => ({}) });

    await collection.update(caller, new Filter({ conditionTree: leaf('id', 'Equal', 'u1') }), {
      name: null,
    });

    expect(client.calls('Update')[0].ExpressionAttributeValues).toEqual({ ':v0': null });
  });

  it('resolves the keys of the matching items when the filter does not pin them', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), {
      Scan: () => ({ Items: [{ id: 'u1' }, { id: 'u2' }] }),
      Update: () => ({}),
    });

    await collection.update(caller, new Filter({ conditionTree: leaf('age', 'Equal', 5) }), {
      name: 'x',
    });

    expect(client.calls('Scan')[0]).toMatchObject({ ProjectionExpression: '#n1' });
    expect(client.calls('Update').map(c => c.Key)).toEqual([{ id: 'u1' }, { id: 'u2' }]);
  });

  it('does nothing when no item matches', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), {
      Scan: () => ({ Items: [] }),
    });

    await collection.update(caller, new Filter({ conditionTree: leaf('age', 'Equal', 5) }), {
      name: 'x',
    });

    expect(client.calls('Update')).toHaveLength(0);
  });

  it('refuses to change a key', async () => {
    const { collection } = buildCollection(buildSimpleModel(), {});

    await expect(
      collection.update(caller, new Filter({ conditionTree: leaf('id', 'Equal', 'u1') }), {
        id: 'u2',
      }),
    ).rejects.toThrow("The key attribute 'id' of 'users' cannot be updated");
  });

  it('accepts a key written with the value it already has', async () => {
    const { collection, client } = buildCollection(buildModel(), { Update: () => ({}) });

    await collection.update(
      caller,
      new Filter({
        conditionTree: and(leaf('customerId', 'Equal', 'c1'), leaf('orderId', 'Equal', 'o1')),
      }),
      { customerId: 'c1', status: 'paid' },
    );

    expect(client.calls('Update')).toHaveLength(1);
    expect(client.calls('Update')[0].UpdateExpression).not.toContain('customerId');
  });

  it('writes nothing when the only change is a key it already has', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), { Update: () => ({}) });

    await collection.update(caller, new Filter({ conditionTree: leaf('id', 'Equal', 'u1') }), {
      id: 'u1',
    });

    expect(client.calls('Update')).toHaveLength(0);
  });

  it('merges client-side when the parent map of a nested path does not exist yet', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), {
      Update: () => {
        throw Object.assign(
          new Error('The document path provided in the update expression is invalid for update'),
          { name: 'ValidationException' },
        );
      },
      Get: () => ({ Item: { id: 'u1', name: 'a' } }),
      Put: () => ({}),
    });

    await collection.update(caller, new Filter({ conditionTree: leaf('id', 'Equal', 'u1') }), {
      'address->city': 'Lyon',
    });

    expect(client.calls('Put')[0]).toMatchObject({
      TableName: 'Users',
      Item: { id: 'u1', name: 'a', address: { city: 'Lyon' } },
      ConditionExpression: 'attribute_exists(#k0)',
    });
  });

  it('does not create an item that does not exist', async () => {
    const { collection } = buildCollection(buildSimpleModel(), {
      Update: () => {
        throw conditional();
      },
    });

    await expect(
      collection.update(caller, new Filter({ conditionTree: leaf('id', 'Equal', 'ghost') }), {
        name: 'x',
      }),
    ).resolves.toBeUndefined();
  });

  it('wraps a failure with the collection name and keeps the cause', async () => {
    const boom = new Error('boom');
    const { collection } = buildCollection(buildSimpleModel(), {
      Update: () => {
        throw boom;
      },
    });

    const error = await collection
      .update(caller, new Filter({ conditionTree: leaf('id', 'Equal', 'u1') }), { name: 'x' })
      .catch(e => e);

    expect(error.message).toBe("Failed to update records of 'users': boom");
    expect(error.cause).toBe(boom);
  });
});

describe('DynamoDBCollection.delete', () => {
  it('deletes by key without reading when the filter pins the keys', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), { BatchWrite: () => ({}) });

    await collection.delete(caller, new Filter({ conditionTree: leaf('id', 'In', ['u1', 'u2']) }));

    expect(client.calls('BatchWrite')).toEqual([
      {
        RequestItems: {
          Users: [
            { DeleteRequest: { Key: { id: 'u1' } } },
            { DeleteRequest: { Key: { id: 'u2' } } },
          ],
        },
      },
    ]);
    expect(client.calls('Scan')).toHaveLength(0);
  });

  it('resolves the keys of the matching items', async () => {
    const { collection, client } = buildCollection(buildModel(), {
      Query: () => ({ Items: [{ customerId: 'c1', orderId: 'o1' }] }),
      BatchWrite: () => ({}),
    });

    await collection.delete(
      caller,
      new Filter({
        conditionTree: and(plain('customerId', 'Equal', 'c1'), plain('status', 'Equal', 'x')),
      }),
    );

    expect(client.calls('BatchWrite')[0].RequestItems.Orders).toEqual([
      { DeleteRequest: { Key: { customerId: 'c1', orderId: 'o1' } } },
    ]);
  });

  it('writes in batches of 25 and retries unprocessed items', async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `u${i}`);
    let first = true;
    const { collection, client } = buildCollection(buildSimpleModel(), {
      BatchWrite: (input: any) => {
        if (first) {
          first = false;

          return { UnprocessedItems: { Users: [input.RequestItems.Users[0]] } };
        }

        return {};
      },
    });

    await collection.delete(caller, new Filter({ conditionTree: leaf('id', 'In', ids) }));

    const sizes = client.calls('BatchWrite').map(c => c.RequestItems.Users.length);
    expect(sizes.sort((a, b) => a - b)).toEqual([1, 5, 25]);
  });

  it('gives up when items stay unprocessed', async () => {
    const { collection } = buildCollection(
      buildSimpleModel(),
      {
        BatchWrite: (input: any) => ({ UnprocessedItems: { Users: input.RequestItems.Users } }),
      },
      { maxWriteRetries: 2 },
    );

    await expect(
      collection.delete(caller, new Filter({ conditionTree: leaf('id', 'Equal', 'u1') })),
    ).rejects.toThrow(
      "Failed to delete records of 'users': 1 item(s) are still unprocessed after 2 retries",
    );
  });

  it('does nothing when no item matches', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), {
      Scan: () => ({ Items: [] }),
    });

    await collection.delete(caller, new Filter({ conditionTree: leaf('age', 'Equal', 1) }));

    expect(client.calls('BatchWrite')).toHaveLength(0);
  });
});
