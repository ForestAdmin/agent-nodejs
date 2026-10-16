import { Sort } from '@forestadmin/datasource-toolkit';

import { planAccessPath, planKeyLookup } from '../../src/utils/access-path';
import { and, buildModel, buildSimpleModel, leaf, or, plain } from '../helpers';

const gsi = (overrides = {}) => ({
  name: 'by-status',
  type: 'GSI' as const,
  partitionKey: { name: 'status', type: 'S' as const },
  sortKey: { name: 'createdAt', type: 'S' as const },
  projectsAllAttributes: true,
  coversAllItems: true,
  ...overrides,
});

describe('planAccessPath', () => {
  it('queries the table when the partition key is pinned by an equality', () => {
    const plan = planAccessPath(buildModel(), leaf('customerId', 'Equal', 'c1'));

    expect(plan).toMatchObject({
      kind: 'query',
      keyCondition: { partition: { attribute: 'customerId', value: 'c1' } },
    });
    expect(plan.indexName).toBeUndefined();
    expect(plan.remaining).toBeUndefined();
  });

  it('keeps the other conditions as filter', () => {
    const plan = planAccessPath(
      buildModel(),
      and(plain('customerId', 'Equal', 'c1'), plain('status', 'Equal', 'paid')),
    );

    expect(plan.kind).toBe('query');
    expect(plan.remaining.toPlainObject()).toEqual(plain('status', 'Equal', 'paid'));
  });

  it('scans when nothing pins a partition key', () => {
    const tree = leaf('status', 'Equal', 'paid');

    const plan = planAccessPath(buildModel(), tree);

    expect(plan.kind).toBe('scan');
    expect(plan.remaining).toBe(tree);
  });

  it('scans without a condition tree', () => {
    expect(planAccessPath(buildModel(), undefined)).toMatchObject({ kind: 'scan' });
  });

  it('does not use an equality hidden inside an OR', () => {
    const plan = planAccessPath(
      buildModel(),
      or(plain('customerId', 'Equal', 'c1'), plain('customerId', 'Equal', 'c2')),
    );

    expect(plan.kind).toBe('scan');
  });

  it('turns a sort key range into a key condition', () => {
    const plan = planAccessPath(
      buildModel(),
      and(plain('customerId', 'Equal', 'c1'), plain('orderId', 'GreaterThan', 'o5')),
    );

    expect(plan.keyCondition.sort).toEqual({
      attribute: 'orderId',
      operator: 'GreaterThan',
      value: 'o5',
    });
    expect(plan.remaining).toBeUndefined();
  });

  it('uses BETWEEN for an inclusive sort key interval', () => {
    const plan = planAccessPath(
      buildModel(),
      and(
        plain('customerId', 'Equal', 'c1'),
        plain('orderId', 'GreaterThanOrEqual', 'o1'),
        plain('orderId', 'LessThanOrEqual', 'o9'),
      ),
    );

    expect(plan.keyCondition.sort).toEqual({
      attribute: 'orderId',
      operator: 'Between',
      value: ['o1', 'o9'],
    });
    expect(plan.remaining).toBeUndefined();
  });

  it('keeps the second bound of an exclusive interval as filter', () => {
    const plan = planAccessPath(
      buildModel(),
      and(
        plain('customerId', 'Equal', 'c1'),
        plain('orderId', 'GreaterThan', 'o1'),
        plain('orderId', 'LessThan', 'o9'),
      ),
    );

    expect(plan.keyCondition.sort).toMatchObject({ operator: 'GreaterThan', value: 'o1' });
    expect(plan.remaining.toPlainObject()).toEqual(plain('orderId', 'LessThan', 'o9'));
  });

  it('queries a global secondary index when its partition key is pinned', () => {
    const model = buildModel({ indexes: [gsi()] });

    const plan = planAccessPath(model, leaf('status', 'Equal', 'paid'));

    expect(plan).toMatchObject({
      kind: 'query',
      indexName: 'by-status',
      keyCondition: { partition: { attribute: 'status', value: 'paid' } },
    });
  });

  it('ignores an index that does not project every attribute', () => {
    const model = buildModel({ indexes: [gsi({ projectsAllAttributes: false })] });

    expect(planAccessPath(model, leaf('status', 'Equal', 'paid')).kind).toBe('scan');
  });

  it('prefers the table when both the table and an index could serve the query', () => {
    const model = buildModel({ indexes: [gsi()] });

    const plan = planAccessPath(
      model,
      and(plain('customerId', 'Equal', 'c1'), plain('status', 'Equal', 'paid')),
    );

    expect(plan.indexName).toBeUndefined();
  });

  it('reads the sort key backwards for a descending sort on it', () => {
    const plan = planAccessPath(
      buildModel(),
      leaf('customerId', 'Equal', 'c1'),
      new Sort({ field: 'orderId', ascending: false }),
    );

    expect(plan).toMatchObject({ scanIndexForward: false, sortSatisfied: true });
  });

  it('does not satisfy a sort on a non-key attribute', () => {
    const plan = planAccessPath(
      buildModel(),
      leaf('customerId', 'Equal', 'c1'),
      new Sort({ field: 'total', ascending: true }),
    );

    expect(plan).toMatchObject({ scanIndexForward: true, sortSatisfied: false });
  });

  it('never claims a sorted result from a scan', () => {
    const plan = planAccessPath(
      buildModel(),
      undefined,
      new Sort({ field: 'orderId', ascending: true }),
    );

    expect(plan.sortSatisfied).toBe(false);
  });

  it('restricts a single-table entity to its sort key prefix', () => {
    const model = buildModel({ entity: { sortKeyPrefix: 'ORDER#' } });

    const plan = planAccessPath(model, leaf('customerId', 'Equal', 'c1'));

    expect(plan.keyCondition.sort).toEqual({
      attribute: 'orderId',
      operator: 'StartsWith',
      value: 'ORDER#',
    });
  });

  it('keeps the prefix as a filter when the user already ranges on the sort key', () => {
    const model = buildModel({ entity: { sortKeyPrefix: 'ORDER#' } });

    const plan = planAccessPath(
      model,
      and(plain('customerId', 'Equal', 'c1'), plain('orderId', 'GreaterThan', 'ORDER#5')),
    );

    expect(plan.keyCondition.sort).toMatchObject({ operator: 'GreaterThan' });
    expect(plan.remaining.toPlainObject()).toEqual(plain('orderId', 'StartsWith', 'ORDER#'));
  });
});

describe('planKeyLookup', () => {
  it('resolves an equality on the partition key of a simple table', () => {
    expect(planKeyLookup(buildSimpleModel(), leaf('id', 'Equal', 'u1'))).toEqual({
      keys: [{ id: 'u1' }],
      remaining: undefined,
    });
  });

  it('resolves an In on the partition key of a simple table', () => {
    expect(planKeyLookup(buildSimpleModel(), leaf('id', 'In', ['u1', 'u2']))).toEqual({
      keys: [{ id: 'u1' }, { id: 'u2' }],
      remaining: undefined,
    });
  });

  it('resolves a composite key given as an OR of equalities (relation emulation shape)', () => {
    const tree = or(
      and(plain('customerId', 'Equal', 'c1'), plain('orderId', 'Equal', 'o1')),
      and(plain('customerId', 'Equal', 'c2'), plain('orderId', 'Equal', 'o2')),
    );

    expect(planKeyLookup(buildModel(), tree).keys).toEqual([
      { customerId: 'c1', orderId: 'o1' },
      { customerId: 'c2', orderId: 'o2' },
    ]);
  });

  it('resolves a composite key given as an AND of equalities', () => {
    const tree = and(plain('customerId', 'Equal', 'c1'), plain('orderId', 'Equal', 'o1'));

    expect(planKeyLookup(buildModel(), tree).keys).toEqual([{ customerId: 'c1', orderId: 'o1' }]);
  });

  it('returns what is left once the key is resolved', () => {
    const tree = and(plain('id', 'Equal', 'u1'), plain('age', 'GreaterThan', 3));

    const lookup = planKeyLookup(buildSimpleModel(), tree);

    expect(lookup.keys).toEqual([{ id: 'u1' }]);
    expect(lookup.remaining.toPlainObject()).toEqual(plain('age', 'GreaterThan', 3));
  });

  it('is not a lookup when the sort key is missing from a composite table', () => {
    expect(planKeyLookup(buildModel(), leaf('customerId', 'Equal', 'c1'))).toBeNull();
  });

  it('is not a lookup for a non-key attribute', () => {
    expect(planKeyLookup(buildSimpleModel(), leaf('name', 'Equal', 'a'))).toBeNull();
  });

  it('is not a lookup without condition', () => {
    expect(planKeyLookup(buildSimpleModel(), undefined)).toBeNull();
  });

  it('is not a lookup when a key value is null', () => {
    expect(planKeyLookup(buildSimpleModel(), leaf('id', 'Equal', null))).toBeNull();
  });
});

describe('key value types', () => {
  const numericModel = () =>
    buildModel({
      partitionKey: { name: 'accountId', type: 'N' },
      sortKey: { name: 'seq', type: 'N' },
    });

  it('reads a numeric partition key given as a numeric string', () => {
    const plan = planAccessPath(numericModel(), leaf('accountId', 'Equal', '42'));

    expect(plan.keyCondition.partition).toEqual({ attribute: 'accountId', value: 42 });
  });

  it('reads a numeric sort key bound given as a numeric string', () => {
    const plan = planAccessPath(
      numericModel(),
      and(plain('accountId', 'Equal', 1), plain('seq', 'GreaterThan', '7')),
    );

    expect(plan.keyCondition.sort).toEqual({
      attribute: 'seq',
      operator: 'GreaterThan',
      value: 7,
    });
  });

  it('reads a string partition key given as a number', () => {
    const plan = planAccessPath(buildModel(), leaf('customerId', 'Equal', 12));

    expect(plan.keyCondition.partition.value).toBe('12');
  });

  it('keeps a non numeric string as it is for a numeric key', () => {
    const plan = planAccessPath(numericModel(), leaf('accountId', 'Equal', 'abc'));

    expect(plan.keyCondition.partition.value).toBe('abc');
  });

  it('types the keys of a lookup', () => {
    const lookup = planKeyLookup(
      buildSimpleModel({ partitionKey: { name: 'id', type: 'N' } }),
      leaf('id', 'In', ['1', 2, '3']),
    );

    expect(lookup.keys).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });
});

describe('secondary indexes that leave items out', () => {
  const sparse = () => buildModel({ indexes: [gsi({ coversAllItems: false })] });

  it('does not read an index by its partition key alone, as items lacking its sort key are not in it', () => {
    expect(planAccessPath(sparse(), leaf('status', 'Equal', 'paid')).kind).toBe('scan');
  });

  it('reads it once a condition on its sort key means the item must be in it', () => {
    const plan = planAccessPath(
      sparse(),
      and(plain('status', 'Equal', 'paid'), plain('createdAt', 'GreaterThan', '2024')),
    );

    expect(plan).toMatchObject({ kind: 'query', indexName: 'by-status' });
  });

  it('reads an index without sort key by its partition key', () => {
    const model = buildModel({
      indexes: [gsi({ sortKey: undefined, coversAllItems: false })],
    });

    expect(planAccessPath(model, leaf('status', 'Equal', 'paid'))).toMatchObject({
      kind: 'query',
      indexName: 'by-status',
    });
  });
});

describe('planKeyLookup soundness', () => {
  it('is not a lookup when an arm of the OR carries a nested filter', () => {
    const tree = or(
      and(plain('id', 'Equal', 'a'), {
        aggregator: 'Or',
        conditions: [plain('age', 'Equal', 1), plain('age', 'Equal', 2)],
      }),
      plain('id', 'Equal', 'b'),
    );

    expect(planKeyLookup(buildSimpleModel(), tree)).toBeNull();
  });

  it('lists each key once for a repeated value', () => {
    expect(planKeyLookup(buildSimpleModel(), leaf('id', 'In', ['a', 'a', 'b'])).keys).toEqual([
      { id: 'a' },
      { id: 'b' },
    ]);
  });

  it('lists each key once for overlapping OR arms', () => {
    const tree = or(
      and(plain('customerId', 'Equal', 'c1'), plain('orderId', 'Equal', 'o1')),
      and(plain('customerId', 'Equal', 'c1'), plain('orderId', 'Equal', 'o1')),
    );

    expect(planKeyLookup(buildModel(), tree).keys).toEqual([{ customerId: 'c1', orderId: 'o1' }]);
  });
});
