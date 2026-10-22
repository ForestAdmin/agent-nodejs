import { Filter, PaginatedFilter, Projection } from '@forestadmin/datasource-toolkit';

import { buildCollection } from './collection-helpers';
import { fakeClient } from './fake-client';
import { buildSimpleModel, leaf } from './helpers';
import { createDynamoDBDataSource } from '../src';
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
    const dataSource = await createDynamoDBDataSource({
      client: fakeClient({}),
      disableIntrospection: true,
      virtualArrayCollections: [
        { parentCollection: 'a', collectionName: 'a_items', arrayField: 'items' },
      ],
      schema: {
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
    })(jest.fn(), jest.fn());

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
    const dataSource = await createDynamoDBDataSource({
      client,
      disableIntrospection: true,
      schema: {
        collections: [
          {
            name: 'u',
            tableName: 'Users',
            partitionKey: { name: 'id', type: 'string' },
            fields: [],
          },
        ],
      },
      liveQueryConnection: 'dynamo',
    })(jest.fn(), jest.fn());

    await expect(dataSource.executeNativeQuery('dynamo', statement, {})).rejects.toThrow(
      'Only SELECT statements can be run as native queries',
    );
    expect(client.calls('ExecuteStatement')).toHaveLength(0);
  });
});
