import type { DataSource } from '@forestadmin/datasource-toolkit';

import {
  Aggregation,
  Filter,
  PaginatedFilter,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';

import { buildCollection } from './collection-helpers';
import { and, buildModel, leaf, plain } from './helpers';
import ArrayCollection from '../src/array-collection';

const caller = { timezone: 'UTC' } as never;

const orders = [
  {
    customerId: 'c1',
    orderId: 'o1',
    lines: [
      { sku: 'A', qty: 1 },
      { sku: 'B', qty: 5 },
    ],
  },
  { customerId: 'c2', orderId: 'o2', lines: [{ sku: 'C', qty: 3 }] },
  { customerId: 'c3', orderId: 'o3' },
];

function build(handlers: Record<string, any>) {
  const parent = buildCollection(
    buildModel({
      schema: {
        customerId: { type: 'string' },
        orderId: { type: 'string' },
        lines: { type: 'array' },
      },
    }),
    handlers,
    { scanConcurrency: 1 },
  );
  const collection = new ArrayCollection({} as DataSource, parent.collection, {
    name: 'order_lines',
    arrayField: 'lines',
    itemSchema: { sku: { type: 'string' }, qty: { type: 'number' } },
  });

  return { collection, client: parent.client };
}

describe('ArrayCollection', () => {
  describe('schema', () => {
    it('is keyed by the parent key and the position in the array', () => {
      const { collection } = build({});

      expect(collection.name).toBe('order_lines');
      expect(
        Object.entries(collection.schema.fields)
          .filter(([, field]) => field.type === 'Column' && field.isPrimaryKey)
          .map(([name]) => name),
      ).toEqual(['customerId', 'orderId', 'index']);
      expect(collection.schema.fields.index).toMatchObject({
        columnType: 'Number',
        isReadOnly: true,
      });
      expect(collection.schema.fields.customerId).toMatchObject({ isReadOnly: true });
    });

    it('exposes the item attributes as columns', () => {
      const { collection } = build({});

      expect(collection.schema.fields.sku).toMatchObject({ columnType: 'String' });
      expect(collection.schema.fields.qty).toMatchObject({ columnType: 'Number' });
    });
  });

  describe('list', () => {
    it('turns each array item of each parent into a record', async () => {
      const { collection } = build({ Scan: () => ({ Items: orders }) });

      const records = await collection.list(
        caller,
        new PaginatedFilter({}),
        new Projection('customerId', 'orderId', 'index', 'sku', 'qty'),
      );

      expect(records).toEqual([
        { customerId: 'c1', orderId: 'o1', index: 0, sku: 'A', qty: 1 },
        { customerId: 'c1', orderId: 'o1', index: 1, sku: 'B', qty: 5 },
        { customerId: 'c2', orderId: 'o2', index: 0, sku: 'C', qty: 3 },
      ]);
    });

    it('reads the parents through their key when the filter pins it', async () => {
      const { collection, client } = build({ Query: () => ({ Items: [orders[0]] }) });

      const records = await collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('customerId', 'Equal', 'c1') }),
        new Projection('index', 'sku'),
      );

      expect(records).toHaveLength(2);
      expect(client.calls('Query')[0]).toMatchObject({ KeyConditionExpression: '#n0 = :v0' });
      expect(client.calls('Scan')).toHaveLength(0);
    });

    it('evaluates the conditions on the items themselves', async () => {
      const { collection } = build({ Scan: () => ({ Items: orders }) });

      const records = await collection.list(
        caller,
        new PaginatedFilter({ conditionTree: leaf('qty', 'GreaterThan', 2) }),
        new Projection('sku'),
      );

      expect(records).toEqual([{ sku: 'B' }, { sku: 'C' }]);
    });

    it('sorts and paginates the records', async () => {
      const { collection } = build({ Scan: () => ({ Items: orders }) });

      const records = await collection.list(
        caller,
        new PaginatedFilter({
          sort: new Sort({ field: 'qty', ascending: false }),
          page: { limit: 1, skip: 1 } as never,
        }),
        new Projection('sku'),
      );

      expect(records).toEqual([{ sku: 'C' }]);
    });

    it('selects the item by its position', async () => {
      const { collection } = build({ BatchGet: () => ({ Responses: { Orders: [orders[0]] } }) });

      const records = await collection.list(
        caller,
        new PaginatedFilter({
          conditionTree: and(
            plain('customerId', 'Equal', 'c1'),
            plain('orderId', 'Equal', 'o1'),
            plain('index', 'Equal', 1),
          ),
        }),
        new Projection('sku'),
      );

      expect(records).toEqual([{ sku: 'B' }]);
    });
  });

  describe('create', () => {
    it('appends the item to the array of its parent and returns its position', async () => {
      const { collection, client } = build({
        Update: () => ({
          Attributes: {
            lines: [
              { sku: 'A', qty: 1 },
              { sku: 'N', qty: 2 },
            ],
          },
        }),
      });

      const created = await collection.create(caller, [
        { customerId: 'c1', orderId: 'o1', sku: 'N', qty: 2 },
      ]);

      expect(created).toEqual([{ customerId: 'c1', orderId: 'o1', index: 1, sku: 'N', qty: 2 }]);
      expect(client.calls('Update')[0]).toEqual({
        TableName: 'Orders',
        Key: { customerId: 'c1', orderId: 'o1' },
        UpdateExpression: 'SET #n0 = list_append(if_not_exists(#n0, :v0), :v1)',
        ConditionExpression: 'attribute_exists(#k0)',
        ExpressionAttributeNames: { '#n0': 'lines', '#k0': 'customerId' },
        ExpressionAttributeValues: { ':v0': [], ':v1': [{ sku: 'N', qty: 2 }] },
        ReturnValues: 'UPDATED_NEW',
      });
    });

    it('requires the whole key of the parent', async () => {
      const { collection } = build({});

      await expect(collection.create(caller, [{ customerId: 'c1', sku: 'N' }])).rejects.toThrow(
        "The key attribute 'orderId' of the parent 'orders' is required to create a record in 'order_lines'",
      );
    });
  });

  describe('update', () => {
    it('sets the attributes of the item at its position', async () => {
      const { collection, client } = build({
        BatchGet: () => ({ Responses: { Orders: [orders[0]] } }),
        Update: () => ({}),
      });

      await collection.update(
        caller,
        new Filter({
          conditionTree: and(
            plain('customerId', 'Equal', 'c1'),
            plain('orderId', 'Equal', 'o1'),
            plain('index', 'Equal', 1),
          ),
        }),
        { qty: 9 },
      );

      expect(client.calls('Update')).toEqual([
        {
          TableName: 'Orders',
          Key: { customerId: 'c1', orderId: 'o1' },
          UpdateExpression: 'SET #n0[1].#n1 = :v0',
          ConditionExpression: 'attribute_exists(#k0)',
          ExpressionAttributeNames: { '#n0': 'lines', '#n1': 'qty', '#k0': 'customerId' },
          ExpressionAttributeValues: { ':v0': 9 },
        },
      ]);
    });

    it('groups the items of the same parent in one update', async () => {
      const { collection, client } = build({
        Query: () => ({ Items: [orders[0]] }),
        Update: () => ({}),
      });

      await collection.update(
        caller,
        new Filter({ conditionTree: leaf('customerId', 'Equal', 'c1') }),
        { qty: 0 },
      );

      expect(client.calls('Update')).toHaveLength(1);
      expect(client.calls('Update')[0].UpdateExpression).toBe(
        'SET #n0[0].#n1 = :v0, #n0[1].#n1 = :v0',
      );
    });

    it('refuses to change the parent key or the position', async () => {
      const { collection } = build({});

      await expect(collection.update(caller, new Filter({}), { customerId: 'x' })).rejects.toThrow(
        "The attribute 'customerId' of 'order_lines' cannot be updated",
      );
      await expect(collection.update(caller, new Filter({}), { index: 3 })).rejects.toThrow(
        "The attribute 'index' of 'order_lines' cannot be updated",
      );
    });
  });

  describe('delete', () => {
    it('removes the matching items from their parent, highest position first', async () => {
      const { collection, client } = build({
        Query: () => ({ Items: [orders[0]] }),
        Update: () => ({}),
      });

      await collection.delete(
        caller,
        new Filter({ conditionTree: leaf('customerId', 'Equal', 'c1') }),
      );

      expect(client.calls('Update')).toEqual([
        {
          TableName: 'Orders',
          Key: { customerId: 'c1', orderId: 'o1' },
          UpdateExpression: 'REMOVE #n0[1], #n0[0]',
          ConditionExpression: 'attribute_exists(#k0)',
          ExpressionAttributeNames: { '#n0': 'lines', '#k0': 'customerId' },
        },
      ]);
    });

    it('does nothing when no item matches', async () => {
      const { collection, client } = build({ Scan: () => ({ Items: [orders[2]] }) });

      await collection.delete(caller, new Filter({}));

      expect(client.calls('Update')).toHaveLength(0);
    });
  });

  describe('aggregate', () => {
    it('aggregates the items', async () => {
      const { collection } = build({ Scan: () => ({ Items: orders }) });

      const result = await collection.aggregate(
        caller,
        new Filter({}),
        new Aggregation({ operation: 'Sum', field: 'qty' }),
      );

      expect(result).toEqual([{ value: 9, group: {} }]);
    });

    it('groups the items by an attribute of their parent', async () => {
      const { collection } = build({ Scan: () => ({ Items: orders }) });

      const result = await collection.aggregate(
        caller,
        new Filter({}),
        new Aggregation({ operation: 'Count', groups: [{ field: 'customerId' }] }),
      );

      expect(result).toEqual([
        { value: 2, group: { customerId: 'c1' } },
        { value: 1, group: { customerId: 'c2' } },
      ]);
    });
  });
});

describe('ArrayCollection of an array', () => {
  const nested = [
    {
      customerId: 'c1',
      orderId: 'o1',
      lines: [
        { sku: 'A', parts: [{ n: 1 }, { n: 2 }] },
        { sku: 'B', parts: [{ n: 3 }] },
      ],
    },
  ];

  function buildNested(handlers: Record<string, any>) {
    const parent = buildCollection(
      buildModel({
        schema: {
          customerId: { type: 'string' },
          orderId: { type: 'string' },
          lines: { type: 'array' },
        },
      }),
      handlers,
      { scanConcurrency: 1 },
    );
    const lines = new ArrayCollection({} as DataSource, parent.collection, {
      name: 'order_lines',
      arrayField: 'lines',
      itemSchema: { sku: { type: 'string' }, parts: { type: 'array' } },
    });
    const parts = new ArrayCollection({} as DataSource, lines, {
      name: 'parts',
      arrayField: 'parts',
      itemSchema: { n: { type: 'number' } },
    });

    return { parts, client: parent.client };
  }

  it('is keyed by the table key and the position in each array', () => {
    const { parts } = buildNested({});

    expect(
      Object.entries(parts.schema.fields)
        .filter(([, field]) => field.type === 'Column' && field.isPrimaryKey)
        .map(([name]) => name),
    ).toEqual(['customerId', 'orderId', 'order_linesIndex', 'index']);
  });

  it('lists the elements of every inner array', async () => {
    const { parts } = buildNested({ Scan: () => ({ Items: nested }) });

    const records = await parts.list(
      caller,
      new PaginatedFilter({}),
      new Projection('order_linesIndex', 'index', 'n'),
    );

    expect(records).toEqual([
      { order_linesIndex: 0, index: 0, n: 1 },
      { order_linesIndex: 0, index: 1, n: 2 },
      { order_linesIndex: 1, index: 0, n: 3 },
    ]);
  });

  it('sets an attribute of an inner element through the path of both arrays', async () => {
    const { parts, client } = buildNested({
      Scan: () => ({ Items: nested }),
      Update: () => ({}),
    });

    await parts.update(caller, new Filter({ conditionTree: leaf('n', 'Equal', 3) }), { n: 9 });

    expect(client.calls('Update')[0]).toMatchObject({
      Key: { customerId: 'c1', orderId: 'o1' },
      UpdateExpression: 'SET #n0[1].#n1[0].#n2 = :v0',
      ExpressionAttributeNames: { '#n0': 'lines', '#n1': 'parts', '#n2': 'n' },
      ExpressionAttributeValues: { ':v0': 9 },
    });
  });

  it('removes inner elements, highest positions first', async () => {
    const { parts, client } = buildNested({
      Scan: () => ({ Items: nested }),
      Update: () => ({}),
    });

    await parts.delete(caller, new Filter({}));

    expect(client.calls('Update')[0].UpdateExpression).toBe(
      'REMOVE #n0[1].#n1[0], #n0[0].#n1[1], #n0[0].#n1[0]',
    );
  });

  it('appends to the inner array of an existing outer element', async () => {
    const { parts, client } = buildNested({
      Update: () => ({ Attributes: { lines: [{ parts: [{ n: 3 }, { n: 4 }] }] } }),
    });

    const created = await parts.create(caller, [
      { customerId: 'c1', orderId: 'o1', order_linesIndex: 1, n: 4 },
    ]);

    expect(created).toEqual([
      { customerId: 'c1', orderId: 'o1', order_linesIndex: 1, index: 1, n: 4 },
    ]);
    expect(client.calls('Update')[0]).toMatchObject({
      UpdateExpression: 'SET #n0[1].#n1 = list_append(if_not_exists(#n0[1].#n1, :v0), :v1)',
      ConditionExpression: 'attribute_exists(#k0) AND attribute_exists(#n0[1])',
    });
  });

  it('requires the position in the outer array to create', async () => {
    const { parts } = buildNested({});

    await expect(parts.create(caller, [{ customerId: 'c1', orderId: 'o1', n: 4 }])).rejects.toThrow(
      "The key attribute 'order_linesIndex' of the parent 'order_lines' is required to create a record in 'parts'",
    );
  });
});
