import type { DataSource } from '@forestadmin/datasource-toolkit';

import { Aggregation, Filter, PaginatedFilter, Projection } from '@forestadmin/datasource-toolkit';

import { buildCollection } from './collection-helpers';
import { fakeClient } from './fake-client';
import { and, buildModel, buildSimpleModel, leaf } from './helpers';
import { createDynamoDBDataSource } from '../src';
import ArrayCollection from '../src/array-collection';
import { inferSchema } from '../src/introspection/introspector';
import { convertManualSchema, validateManualSchema } from '../src/schema/manual-schema';
import { resolveSettings } from '../src/settings';
import Serializer from '../src/utils/serializer';

const caller = { timezone: 'UTC' } as never;

describe('a number beyond the safe integer range', () => {
  it('is read as text so that the response can be serialized', () => {
    expect(Serializer.normalize(10n ** 20n)).toBe('100000000000000000000');
  });

  it('does not make a list fail', async () => {
    const { collection } = buildCollection(
      buildSimpleModel({ schema: { id: { type: 'string' }, big: { type: 'number' } } }),
      { Scan: () => ({ Items: [{ id: 'u1', big: 10n ** 20n }] }) },
      { scanConcurrency: 1 },
    );

    const records = await collection.list(
      caller,
      new PaginatedFilter({}),
      new Projection('id', 'big'),
    );

    expect(JSON.stringify(records)).toBe('[{"id":"u1","big":"100000000000000000000"}]');
  });
});

describe('string and number sets', () => {
  const model = () =>
    buildSimpleModel({
      schema: { id: { type: 'string' }, tags: { type: 'array', set: true } },
    });

  it('are marked by the introspection when every sampled value is a Set', () => {
    const schema = inferSchema(
      [
        { id: 'a', tags: new Set(['x']), list: ['x'] },
        { id: 'b', tags: new Set(['y']), list: new Set(['z']) },
      ],
      [{ name: 'id', type: 'S' }],
      5,
    );

    expect(schema.tags.set).toBe(true);
    expect(schema.list.set).toBeUndefined();
  });

  it('can be declared in a manual schema', () => {
    const [table] = convertManualSchema({
      collections: [
        {
          name: 'a',
          tableName: 'A',
          partitionKey: { name: 'id', type: 'string' },
          fields: [{ name: 'tags', type: 'array', subType: 'string', set: true }],
        },
      ],
    });

    expect(table.schema.tags).toMatchObject({ type: 'array', set: true });
  });

  it('are refused on a field that is not an array of strings or numbers', () => {
    expect(() =>
      validateManualSchema({
        collections: [
          {
            name: 'a',
            tableName: 'A',
            partitionKey: { name: 'id', type: 'string' },
            fields: [{ name: 'tags', type: 'string', set: true }],
          },
        ],
      }),
    ).toThrow("Field 'tags' in collection 'a' cannot be a set");
  });

  it('are written back as sets on create', async () => {
    const { collection, client } = buildCollection(model(), { Put: () => ({}) });

    await collection.create(caller, [{ id: 'u1', tags: ['a', 'b'] }]);

    const { tags } = client.calls('Put')[0].Item;
    expect(tags).toBeInstanceOf(Set);
    expect([...tags]).toEqual(['a', 'b']);
  });

  it('are written back as sets on update', async () => {
    const { collection, client } = buildCollection(model(), { Update: () => ({}) });

    await collection.update(caller, new Filter({ conditionTree: leaf('id', 'Equal', 'u1') }), {
      tags: ['a'],
    });

    const [value] = Object.values(client.calls('Update')[0].ExpressionAttributeValues);
    expect(value).toBeInstanceOf(Set);
  });
});

describe('clearing a set', () => {
  const model = () =>
    buildSimpleModel({
      schema: {
        id: { type: 'string' },
        name: { type: 'string', nullable: true },
        tags: { type: 'array', set: true, nullable: true },
      },
    });
  const byId = () => new Filter({ conditionTree: leaf('id', 'Equal', 'u1') });

  it('leaves the attribute out on create, since DynamoDB holds no empty set', async () => {
    const { collection, client } = buildCollection(model(), { Put: () => ({}) });

    const [created] = await collection.create(caller, [{ id: 'u1', tags: [] }]);

    expect(Object.keys(client.calls('Put')[0].Item)).toEqual(['id']);
    expect(created.tags).toEqual([]);
  });

  it('removes the attribute on update', async () => {
    const { collection, client } = buildCollection(model(), { Update: () => ({}) });

    await collection.update(caller, byId(), { tags: [] });

    const call = client.calls('Update')[0];
    expect(call.UpdateExpression).toBe('REMOVE #n0');
    expect(call.ExpressionAttributeNames).toMatchObject({ '#n0': 'tags' });
    expect(call.ExpressionAttributeValues).toBeUndefined();
  });

  it('removes it next to the other attributes of the same update', async () => {
    const { collection, client } = buildCollection(model(), { Update: () => ({}) });

    await collection.update(caller, byId(), { name: 'x', tags: [] });

    expect(client.calls('Update')[0].UpdateExpression).toBe('SET #n0 = :v0 REMOVE #n1');
  });

  it('removes it in the client-side rewrite too', async () => {
    const { collection, client } = buildCollection(model(), {
      Update: () => {
        throw Object.assign(new Error('The document path provided is invalid for update'), {
          name: 'ValidationException',
        });
      },
      Get: () => ({ Item: { id: 'u1', tags: new Set(['a']), name: 'n' } }),
      Put: () => ({}),
    });

    await collection.update(caller, byId(), { name: 'x', tags: [] });

    expect(client.calls('Put')[0].Item).toEqual({ id: 'u1', name: 'x' });
  });
});

describe('a manual schema collection without fields', () => {
  it('exposes its keys instead of failing', () => {
    const [table] = convertManualSchema({
      collections: [{ name: 'a', tableName: 'A', partitionKey: { name: 'id', type: 'string' } }],
    } as never);

    expect(Object.keys(table.schema)).toEqual(['id']);
  });
});

describe('the option naming the virtual collections', () => {
  it('also reads the name the ticket gives it', async () => {
    const dataSource = await createDynamoDBDataSource(
      {
        client: fakeClient({}),

        virtualArrayCollections: [
          { parentCollection: 'a', collectionName: 'a_items', arrayField: 'items' },
        ],
      },
      {
        introspection: {
          collections: [
            {
              name: 'a',
              tableName: 'A',
              partitionKey: { name: 'id', type: 'string' },
              fields: [
                {
                  name: 'items',
                  type: 'array',
                  subType: 'object',
                  fields: [{ name: 'k', type: 'string' }],
                },
              ],
            },
          ],
        },
      },
    )(jest.fn(), jest.fn());

    expect(dataSource.collections.map(c => c.name).sort()).toEqual(['a', 'a_items']);
  });
});

describe('the scanPolicy option', () => {
  it('refuses a value that is not allow, warn or deny', () => {
    expect(() => resolveSettings({ scanPolicy: 'Deny' as never })).toThrow(
      "Invalid scanPolicy 'Deny': use allow, warn or deny",
    );
  });

  it.each(['allow', 'warn', 'deny'] as const)('accepts %s', scanPolicy => {
    expect(resolveSettings({ scanPolicy }).scanPolicy).toBe(scanPolicy);
  });
});

describe('native queries', () => {
  it.each([
    "INSERT INTO \"Users\" VALUE {'id': 'x'}",
    "UPDATE \"Users\" SET name = 'x' WHERE id = 'a'",
    'DELETE FROM "Users" WHERE id = \'a\'',
  ])('refuse the statement %s', async statement => {
    const client = fakeClient({ ExecuteStatement: () => ({ Items: [] }) });
    const dataSource = await createDynamoDBDataSource(
      {
        client,

        liveQueryConnection: 'dynamo',
      },
      {
        introspection: {
          collections: [
            {
              name: 'u',
              tableName: 'Users',
              partitionKey: { name: 'id', type: 'string' },
              fields: [],
            },
          ],
        },
      },
    )(jest.fn(), jest.fn());

    await expect(dataSource.executeNativeQuery('dynamo', statement, {})).rejects.toThrow(
      'Only SELECT statements can be run as native queries',
    );
    expect(client.calls('ExecuteStatement')).toHaveLength(0);
  });
});

describe('a chart computed while a write happens', () => {
  it('does not put its stale result back in the cache', async () => {
    let release: (value: unknown) => void;
    const firstScan = new Promise(resolve => {
      release = resolve;
    });
    let scans = 0;
    const { collection } = buildCollection(
      buildSimpleModel(),
      {
        Scan: () => {
          scans += 1;

          return scans === 1 ? firstScan : { Items: [{ age: 2 }] };
        },
        Put: () => ({}),
      },
      { chartCacheTtlMs: 60000, scanConcurrency: 1 },
    );
    const sum = new Aggregation({ operation: 'Sum', field: 'age' });

    const started = collection.aggregate(caller, new Filter({}), sum);
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });
    await collection.create(caller, [{ id: 'u9', age: 5 }]);
    release({ Items: [{ age: 1 }] });
    await started;

    const after = await collection.aggregate(caller, new Filter({}), sum);

    expect(after).toEqual([{ value: 2, group: {} }]);
  });
});

describe('an attribute an item does not have', () => {
  const model = () =>
    buildSimpleModel({
      schema: {
        id: { type: 'string' },
        name: { type: 'string', nullable: true },
        'address@@@city': { type: 'string', nullable: true },
      },
    });
  const items = [
    { id: 'a', name: 'x', address: { city: 'Paris' } },
    { id: 'b' },
    { id: 'c', name: null, address: {} },
  ];

  it('is read as null', async () => {
    const { collection } = buildCollection(
      model(),
      { Scan: () => ({ Items: items }) },
      { scanConcurrency: 1 },
    );

    const records = await collection.list(
      caller,
      new PaginatedFilter({ sort: undefined }),
      new Projection('id', 'name', 'address@@@city'),
    );

    expect(records.find(record => record.id === 'b')).toEqual({
      id: 'b',
      name: null,
      'address@@@city': null,
    });
  });
});

describe('the binary and set attributes of an array element', () => {
  const build = (handlers: Record<string, any>) => {
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
      itemSchema: {
        sku: { type: 'string' },
        blob: { type: 'binary', nullable: true },
        labels: { type: 'array', set: true, nullable: true },
      },
    });

    return { collection, client: parent.client };
  };

  const order = { customerId: 'c1', orderId: 'o1', lines: [{ sku: 'A' }] };
  const first = new Filter({
    conditionTree: leaf('customerId', 'Equal', 'c1'),
  });
  const valuesOf = (call: Record<string, any>) => Object.values(call.ExpressionAttributeValues);

  it('stores bytes and a set when an element is appended', async () => {
    const { collection, client } = build({
      Update: () => ({ Attributes: { lines: [{ sku: 'A' }, { sku: 'N' }] } }),
    });

    await collection.create(caller, [
      { customerId: 'c1', orderId: 'o1', sku: 'N', blob: 'AQID', labels: ['a', 'b'] },
    ]);

    const appended = valuesOf(client.calls('Update')[0]).find(
      value => Array.isArray(value) && value.length,
    ) as any[];
    const [element] = appended.filter(value => value.sku === 'N');
    expect(Array.from(element.blob)).toEqual([1, 2, 3]);
    expect(element.labels).toBeInstanceOf(Set);
  });

  it('leaves an emptied set out of an appended element', async () => {
    const { collection, client } = build({
      Update: () => ({ Attributes: { lines: [{ sku: 'N' }] } }),
    });

    await collection.create(caller, [{ customerId: 'c1', orderId: 'o1', sku: 'N', labels: [] }]);

    const [element] = valuesOf(client.calls('Update')[0]).find(
      value => Array.isArray(value) && value.length,
    ) as any[];
    expect(Object.keys(element)).toEqual(['sku']);
  });

  it('stores bytes and a set when an element is updated', async () => {
    const { collection, client } = build({
      Query: () => ({ Items: [order] }),
      Update: () => ({}),
    });

    await collection.update(caller, first, { blob: 'AQID', labels: ['x'] });

    const [bytes, set] = valuesOf(client.calls('Update')[0]);
    expect(Array.from(bytes as Uint8Array)).toEqual([1, 2, 3]);
    expect(set).toBeInstanceOf(Set);
  });

  it('removes the attribute of an element whose set is emptied', async () => {
    const { collection, client } = build({
      Query: () => ({ Items: [order] }),
      Update: () => ({}),
    });

    await collection.update(caller, first, { labels: [] });

    const call = client.calls('Update')[0];
    expect(call.UpdateExpression).toMatch(/^REMOVE #n0\[0\]\.#n1$|^REMOVE #n0\[0\]\.#n1 *$/);
    expect(call.ExpressionAttributeValues).toBeUndefined();
  });

  it('sets and removes in one statement, so the second does not look for a record the first changed', async () => {
    const { collection, client } = build({
      Query: () => ({ Items: [{ ...order, lines: [{ sku: 'A', labels: new Set(['old']) }] }] }),
      Update: () => ({}),
    });

    await collection.update(
      caller,
      new Filter({
        conditionTree: and(leaf('customerId', 'Equal', 'c1'), leaf('sku', 'Equal', 'A')),
      }),
      { sku: 'B', labels: [] },
    );

    expect(client.calls('Update')).toHaveLength(1);
    expect(client.calls('Update')[0].UpdateExpression).toMatch(
      /^SET #n0\[0\]\.#n1 = :v0 REMOVE #n0\[0\]\.#n2$/,
    );
  });

  it('stores bytes and a set in the client-side rewrite too', async () => {
    const { collection, client } = build({
      Query: () => ({ Items: [order] }),
      Update: () => {
        throw Object.assign(new Error('The document path provided is invalid for update'), {
          name: 'ValidationException',
        });
      },
      Get: () => ({ Item: { ...order, lines: [{ sku: 'A', labels: new Set(['old']) }] } }),
      Put: () => ({}),
    });

    await collection.update(caller, first, { blob: 'AQID', labels: [] });

    expect(client.calls('Put')).toHaveLength(1);
    const [line] = client.calls('Put')[0].Item.lines;
    expect(Array.from(line.blob)).toEqual([1, 2, 3]);
    expect(line).not.toHaveProperty('labels');
  });
});
