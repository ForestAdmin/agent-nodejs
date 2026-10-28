import type { DataSource } from '@forestadmin/datasource-toolkit';

import { Aggregation, Filter, PaginatedFilter, Projection } from '@forestadmin/datasource-toolkit';

import { buildCollection } from './collection-helpers';
import { fakeClient } from './fake-client';
import { and, buildModel, buildSimpleModel, leaf, plain } from './helpers';
import ArrayCollection from '../src/array-collection';
import DynamoDBCollection from '../src/collection';
import { introspectTables } from '../src/introspection/introspector';
import { validateManualSchema } from '../src/schema/manual-schema';
import { resolveSettings } from '../src/settings';
import { planAccessPath } from '../src/utils/access-path';
import Serializer from '../src/utils/serializer';

const caller = { timezone: 'UTC' } as never;
const sum = new Aggregation({ operation: 'Sum', field: 'age' });

describe('chart caches', () => {
  it('drops the charts of every collection of a table when one of them writes', async () => {
    const client = fakeClient({ Scan: () => ({ Items: [{ age: 1 }] }), Put: () => ({}) });
    const settings = resolveSettings({ chartCacheTtlMs: 60000, scanConcurrency: 1 });
    const build = (name: string, entity?: { sortKeyPrefix: string }) =>
      new DynamoDBCollection(
        {} as DataSource,
        buildModel({
          name,
          entity,
          schema: {
            customerId: { type: 'string' },
            orderId: { type: 'string' },
            age: { type: 'number' },
          },
        }),
        client,
        jest.fn(),
        settings,
      );
    const whole = build('whole');
    const orders = build('orders', { sortKeyPrefix: 'ORDER#' });

    await whole.aggregate(caller, new Filter({}), sum);
    await orders.create(caller, [{ customerId: 'c', orderId: 'ORDER#1' }]);
    await whole.aggregate(caller, new Filter({}), sum);

    expect(client.calls('Scan')).toHaveLength(2);
  });

  it('is not poisoned by a caller that renames the groups it is given', async () => {
    const { collection } = buildCollection(
      buildSimpleModel(),
      { Scan: () => ({ Items: [{ age: 1, name: 'a' }] }) },
      { chartCacheTtlMs: 60000, scanConcurrency: 1 },
    );
    const byName = new Aggregation({ operation: 'Sum', field: 'age', groups: [{ field: 'name' }] });

    const first = await collection.aggregate(caller, new Filter({}), byName);
    first[0].group['relation:id'] = first[0].group.name;
    delete first[0].group.name;
    const second = await collection.aggregate(caller, new Filter({}), byName);

    expect(second).toEqual([{ value: 1, group: { name: 'a' } }]);
  });
});

describe('array collections', () => {
  const parentWith = (handlers: Record<string, any>, model = buildModel()) => {
    const parent = buildCollection(
      {
        ...model,
        schema: {
          customerId: { type: 'string' },
          orderId: { type: 'string' },
          lines: { type: 'array' },
          details: { type: 'object' },
        },
      },
      handlers,
      { scanConcurrency: 1 },
    );

    return {
      client: parent.client,
      parent: parent.collection,
      lines: (arrayField = 'lines') =>
        new ArrayCollection({} as DataSource, parent.collection, {
          name: 'order_lines',
          arrayField,
          itemSchema: { sku: { type: 'string' }, metadata: { type: 'object' } },
        }),
    };
  };

  it('refuses a table key named like the position column', () => {
    const { lines } = parentWith({}, buildModel({ sortKey: { name: 'index', type: 'S' } }));

    expect(() => lines()).toThrow("The key columns of 'order_lines' must have distinct names");
  });

  it('replaces an object attribute as a whole when it rewrites the item, as SET would', async () => {
    const order = {
      customerId: 'c1',
      orderId: 'o1',
      lines: [{ sku: 'A', metadata: { a: 1, b: 2 } }],
    };
    const { lines, client } = parentWith({
      Scan: () => ({ Items: [order] }),
      Update: () => {
        throw Object.assign(new Error('The document path provided is invalid'), {
          name: 'ValidationException',
        });
      },
      Get: () => ({ Item: JSON.parse(JSON.stringify(order)) }),
      Put: () => ({}),
    });

    await lines().update(caller, new Filter({}), { metadata: { a: 3 } });

    expect(client.calls('Put')[0].Item.lines[0].metadata).toEqual({ a: 3 });
  });

  it('creates the first element of an array held in a map the item does not have', async () => {
    const { lines, client } = parentWith({
      Update: () => {
        throw Object.assign(new Error('The document path provided is invalid'), {
          name: 'ValidationException',
        });
      },
      Get: () => ({ Item: { customerId: 'c1', orderId: 'o1' } }),
      Put: () => ({}),
    });

    const [created] = await lines('details@@@lines').create(caller, [
      { customerId: 'c1', orderId: 'o1', sku: 'A' },
    ]);

    expect(created).toMatchObject({ index: 0, sku: 'A' });
    expect(client.calls('Put')[0].Item).toEqual({
      customerId: 'c1',
      orderId: 'o1',
      details: { lines: [{ sku: 'A' }] },
    });
  });
});

describe('attribute names holding the path separator', () => {
  it('skips a table with such an attribute, and says why', async () => {
    const client = fakeClient({
      DescribeTable: () => ({
        Table: {
          TableName: 'T',
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        },
      }),
      Scan: () => ({ Items: [{ id: 'a', 'a@@@b': 1 }] }),
    });
    const logger = jest.fn();

    const models = await introspectTables(client, { tables: ['T'] }, logger);

    expect(models).toEqual([]);
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      "Introspector - Skipping table 'T': Attribute 'a@@@b' contains '@@@', which names nested attributes",
    );
  });

  it('rejects a manual field named so', () => {
    expect(() =>
      validateManualSchema({
        collections: [
          {
            name: 'c',
            tableName: 'T',
            partitionKey: { name: 'pk', type: 'string' },
            fields: [{ name: 'a@@@b', type: 'string' }],
          },
        ],
      }),
    ).toThrow("Field 'a@@@b' in collection 'c' contains '@@@'");
  });
});

describe('single-table creation and reads', () => {
  const entityModel = () =>
    buildModel({
      entity: { attribute: 'entityType', value: 'ORDER' },
      schema: {
        customerId: { type: 'string' },
        orderId: { type: 'string' },
        entityType: { type: 'string' },
      },
    });

  it('returns the discriminator the record was stored with', async () => {
    const { collection } = buildCollection(entityModel(), { Put: () => ({}) });

    const [created] = await collection.create(caller, [{ customerId: 'c', orderId: 'o' }]);

    expect(created.entityType).toBe('ORDER');
  });

  it('does not let a first page of an entity collection bypass a deny policy', async () => {
    const { collection } = buildCollection(
      { ...entityModel(), scanPolicy: 'deny' },
      { Scan: () => ({ Items: [] }) },
    );

    await expect(
      collection.list(
        caller,
        new PaginatedFilter({ page: { skip: 0, limit: 15 } as never }),
        new Projection('orderId'),
      ),
    ).rejects.toThrow("refused by scanPolicy 'deny'");
  });
});

describe('a reversed range on the sort key', () => {
  it('is not sent as a BETWEEN, which DynamoDB rejects', () => {
    const plan = planAccessPath(
      buildModel(),
      and(
        plain('customerId', 'Equal', 'c1'),
        plain('orderId', 'GreaterThanOrEqual', 'o9'),
        plain('orderId', 'LessThanOrEqual', 'o1'),
      ),
    );

    expect(plan.keyCondition.sort?.operator).not.toBe('Between');
    expect(plan.remaining.toPlainObject()).toEqual(plain('orderId', 'LessThanOrEqual', 'o1'));
  });

  it('matches nothing when read', async () => {
    const { collection } = buildCollection(buildModel(), {
      Query: () => ({
        Items: [{ customerId: 'c1', orderId: 'o9' }],
      }),
    });

    const records = await collection.list(
      caller,
      new PaginatedFilter({
        conditionTree: and(
          plain('customerId', 'Equal', 'c1'),
          plain('orderId', 'GreaterThanOrEqual', 'o9'),
          plain('orderId', 'LessThanOrEqual', 'o1'),
        ),
      }),
      new Projection('orderId'),
    );

    expect(records).toEqual([]);
  });
});

describe('writing records', () => {
  it('refuses a path through __proto__ instead of changing every object', () => {
    expect(() => Serializer.unflatten({ '__proto__@@@polluted': 'yes' })).toThrow(
      "An attribute path cannot contain '__proto__'",
    );
    expect(() => Serializer.setPath({}, ['__proto__', 'polluted'], 'yes')).toThrow(
      "An attribute path cannot contain '__proto__'",
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('does not take an inherited property for a map to write into', () => {
    const item = Serializer.unflatten({ 'constructor@@@name': 'x' });

    expect(Object.keys(item)).toEqual(['constructor']);
    expect((item.constructor as unknown as Record<string, unknown>).name).toBe('x');
    expect(Object.prototype.constructor.name).toBe('Object');
  });

  it('reads the item strongly consistent before rewriting it', async () => {
    const { collection, client } = buildCollection(buildSimpleModel(), {
      Update: () => {
        throw Object.assign(new Error('The document path provided is invalid'), {
          name: 'ValidationException',
        });
      },
      Get: () => ({ Item: { id: 'u1' } }),
      Put: () => ({}),
    });

    await collection.update(caller, new Filter({ conditionTree: leaf('id', 'Equal', 'u1') }), {
      'address@@@city': 'Lyon',
    });

    expect(client.calls('Get')[0].ConsistentRead).toBe(true);
  });
});
