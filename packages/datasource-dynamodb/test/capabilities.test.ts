import type { DataSource } from '@forestadmin/datasource-toolkit';

import { PaginatedFilter, Projection, Sort } from '@forestadmin/datasource-toolkit';

import { buildCollection } from './collection-helpers';
import { buildModel, leaf } from './helpers';
import ArrayCollection from '../src/array-collection';
import { resolveSettings } from '../src/settings';

const caller = { timezone: 'UTC' } as never;

const model = () =>
  buildModel({
    schema: {
      customerId: { type: 'string' },
      orderId: { type: 'string' },
      status: { type: 'string', nullable: true },
      total: { type: 'number' },
      createdAt: { type: 'date' },
      lines: { type: 'array' },
    },
    indexes: [
      {
        name: 'by-status',
        type: 'GSI',
        partitionKey: { name: 'status', type: 'S' },
        sortKey: { name: 'createdAt', type: 'S' },
        projectsAllAttributes: true,
      },
    ],
  });

const fieldsOf = (settings = {}) =>
  buildCollection(model(), {}, settings).collection.schema.fields as Record<
    string,
    { filterOperators: Set<string>; isSortable: boolean }
  >;

describe('what Forest may ask of a table collection', () => {
  const IN_MEMORY_ONLY = ['IContains', 'NotIContains', 'EndsWith', 'Like', 'ILike', 'Match'];

  it('keeps the filters DynamoDB evaluates itself on every attribute', () => {
    const { status, total, orderId } = fieldsOf();

    expect([...status.filterOperators]).toEqual(
      expect.arrayContaining([
        'Equal',
        'NotEqual',
        'In',
        'StartsWith',
        'Contains',
        'Blank',
        'Present',
      ]),
    );
    expect([...total.filterOperators]).toEqual(
      expect.arrayContaining(['Equal', 'LessThan', 'GreaterThanOrEqual', 'In']),
    );
    expect([...orderId.filterOperators]).toEqual(expect.arrayContaining(['Equal', 'In']));
  });

  it.each(IN_MEMORY_ONLY)(
    'does not offer %s, which would read every item to filter it',
    operator => {
      const { status } = fieldsOf();

      expect(status.filterOperators.has(operator)).toBe(false);
    },
  );

  it('does not offer the relative date operators', () => {
    const { createdAt } = fieldsOf();

    expect(
      [...createdAt.filterOperators].filter(op =>
        /Ago|Today|Yesterday|Previous|Future|Past|Before|After/.test(op),
      ),
    ).toEqual([]);
  });

  it('sorts on the sort key of the table and of an index only', () => {
    const fields = fieldsOf();

    expect(fields.orderId.isSortable).toBe(true);
    expect(fields.createdAt.isSortable).toBe(true);
    expect(fields.customerId.isSortable).toBe(false);
    expect(fields.status.isSortable).toBe(false);
    expect(fields.total.isSortable).toBe(false);
  });

  it('gives back every operator and every sort when the items may be processed in memory', () => {
    const fields = fieldsOf({ inMemoryProcessing: true });

    expect(fields.status.filterOperators.has('IContains')).toBe(true);
    expect(fields.status.filterOperators.has('Like')).toBe(true);
    expect(fields.total.isSortable).toBe(true);
    expect(fields.customerId.isSortable).toBe(true);
  });

  it('is off by default', () => {
    expect(resolveSettings().inMemoryProcessing).toBe(false);
  });
});

describe('Present', () => {
  it('is evaluated by DynamoDB, as the negation of Blank', async () => {
    const { collection, client } = buildCollection(
      model(),
      { Scan: () => ({ Items: [] }) },
      { scanConcurrency: 1 },
    );

    await collection.list(
      caller,
      new PaginatedFilter({ conditionTree: leaf('status', 'Present') }),
      new Projection('orderId'),
    );

    expect(client.calls('Scan')[0].FilterExpression).toMatch(
      /^NOT \(attribute_not_exists\(#n0\) OR attribute_type\(#n0, :v0\) OR #n0 = :v1\)$/,
    );
  });
});

describe('what Forest may ask of a collection of array elements', () => {
  const build = (settings = {}) => {
    const parent = buildCollection(model(), {}, settings);

    return new ArrayCollection({} as DataSource, parent.collection, {
      name: 'order_lines',
      arrayField: 'lines',
      itemSchema: { sku: { type: 'string' }, qty: { type: 'number' } },
    }).schema.fields as Record<string, { filterOperators: Set<string>; isSortable: boolean }>;
  };

  it('filters on the keys of the table item and the position of the element', () => {
    const fields = build();

    for (const key of ['customerId', 'orderId', 'index']) {
      expect([...fields[key].filterOperators].sort()).toEqual(['Equal', 'In']);
      expect(fields[key].isSortable).toBe(false);
    }
  });

  it('does not filter or sort on the attributes of the elements, which live inside the item', () => {
    const fields = build();

    expect(fields.sku.filterOperators.size).toBe(0);
    expect(fields.sku.isSortable).toBe(false);
    expect(fields.qty.filterOperators.size).toBe(0);
  });

  it('gives them back when the items may be processed in memory', () => {
    const fields = build({ inMemoryProcessing: true });

    expect(fields.sku.filterOperators.has('Equal')).toBe(true);
    expect(fields.qty.isSortable).toBe(true);
  });
});

describe('a sort Forest should not ask for', () => {
  const list = (sortField: string, settings = {}) => {
    const { collection, client } = buildCollection(
      model(),
      { Scan: () => ({ Items: [{ customerId: 'c', orderId: 'o', status: 'b', total: 1 }] }) },
      { scanConcurrency: 1, ...settings },
    );

    return {
      client,
      result: collection.list(
        caller,
        new PaginatedFilter({ sort: new Sort({ field: sortField, ascending: true }) }),
        new Projection('orderId'),
      ),
    };
  };

  it('is refused on an attribute that is not a key, which would read every item', async () => {
    const { client, result } = list('total');

    await expect(result).rejects.toThrow(
      "Sorting on 'total' reads every item and sorts them in memory: DynamoDB sorts on keys only. " +
        'Set inMemoryProcessing to allow it.',
    );
    expect(client.calls('Scan')).toHaveLength(0);
  });

  it.each(['orderId', 'createdAt', 'customerId', 'status'])(
    'is allowed on %s when the items may be processed in memory',
    async field => {
      const { result } = list(field, { inMemoryProcessing: true });

      await expect(result).resolves.toHaveLength(1);
    },
  );

  it.each(['orderId', 'customerId'])('is allowed on the key %s', async field => {
    const { result } = list(field);

    await expect(result).resolves.toHaveLength(1);
  });
});
