import { ConditionTreeFactory } from '@forestadmin/datasource-toolkit';

import ExpressionBuilder, { splitCondition } from '../../src/utils/expression-builder';

const leaf = (field: string, operator: string, value?: unknown) =>
  ConditionTreeFactory.fromPlainObject({ field, operator, value } as never);

describe('ExpressionBuilder', () => {
  describe('condition', () => {
    it('aliases attribute names and values so reserved words are safe', () => {
      const builder = new ExpressionBuilder();

      const expression = builder.condition(leaf('status', 'Equal', 'paid'));

      expect(expression).toBe('#n0 = :v0');
      expect(builder.names).toEqual({ '#n0': 'status' });
      expect(builder.values).toEqual({ ':v0': 'paid' });
    });

    it('reuses the alias of an attribute used twice', () => {
      const builder = new ExpressionBuilder();

      builder.condition(
        ConditionTreeFactory.fromPlainObject({
          aggregator: 'And',
          conditions: [
            { field: 'age', operator: 'GreaterThan', value: 1 },
            { field: 'age', operator: 'LessThan', value: 9 },
          ],
        }),
      );

      expect(builder.names).toEqual({ '#n0': 'age' });
    });

    it('turns arrow notation into a nested document path', () => {
      const builder = new ExpressionBuilder();

      expect(builder.condition(leaf('address->city', 'Equal', 'Paris'))).toBe('#n0.#n1 = :v0');
      expect(builder.names).toEqual({ '#n0': 'address', '#n1': 'city' });
    });

    it('wraps and/or branches in parentheses', () => {
      const builder = new ExpressionBuilder();

      const expression = builder.condition(
        ConditionTreeFactory.fromPlainObject({
          aggregator: 'Or',
          conditions: [
            { field: 'a', operator: 'Equal', value: 1 },
            {
              aggregator: 'And',
              conditions: [
                { field: 'b', operator: 'Equal', value: 2 },
                { field: 'c', operator: 'Equal', value: 3 },
              ],
            },
          ],
        }),
      );

      expect(expression).toBe('(#n0 = :v0 OR (#n1 = :v1 AND #n2 = :v2))');
    });

    it.each([
      ['NotEqual', '#n0 <> :v0'],
      ['LessThan', '#n0 < :v0'],
      ['LessThanOrEqual', '#n0 <= :v0'],
      ['GreaterThan', '#n0 > :v0'],
      ['GreaterThanOrEqual', '#n0 >= :v0'],
      ['StartsWith', 'begins_with(#n0, :v0)'],
      ['Contains', 'contains(#n0, :v0)'],
      ['NotContains', 'NOT contains(#n0, :v0)'],
    ])('translates %s', (operator, expected) => {
      const builder = new ExpressionBuilder();

      expect(builder.condition(leaf('f', operator, 5))).toBe(expected);
      expect(builder.values).toEqual({ ':v0': 5 });
    });

    it('treats Equal null as a missing or NULL attribute', () => {
      const builder = new ExpressionBuilder();

      expect(builder.condition(leaf('f', 'Equal', null))).toBe(
        '(attribute_not_exists(#n0) OR attribute_type(#n0, :v0))',
      );
      expect(builder.values).toEqual({ ':v0': 'NULL' });
    });

    it('translates Missing as a missing or NULL attribute', () => {
      const missing = new ExpressionBuilder();

      expect(missing.condition(leaf('f', 'Missing'))).toBe(
        '(attribute_not_exists(#n0) OR attribute_type(#n0, :v0))',
      );
    });

    it('translates In into an IN list', () => {
      const builder = new ExpressionBuilder();

      expect(builder.condition(leaf('f', 'In', ['a', 'b']))).toBe('#n0 IN (:v0, :v1)');
      expect(builder.values).toEqual({ ':v0': 'a', ':v1': 'b' });
    });

    it('splits an In list of more than 100 values into several IN groups', () => {
      const builder = new ExpressionBuilder();
      const values = Array.from({ length: 150 }, (_, i) => i);

      const expression = builder.condition(leaf('f', 'In', values));

      expect(expression.startsWith('(#n0 IN (')).toBe(true);
      expect(expression.match(/ IN \(/g)).toHaveLength(2);
      expect(expression).toContain(') OR #n0 IN (');
      expect(Object.keys(builder.values)).toHaveLength(150);
    });

    it('lets In match null values too', () => {
      const builder = new ExpressionBuilder();

      expect(builder.condition(leaf('f', 'In', ['a', null]))).toBe(
        '(#n0 IN (:v0) OR (attribute_not_exists(#n0) OR attribute_type(#n0, :v1)))',
      );
    });

    it('turns an empty In into a contradiction', () => {
      const builder = new ExpressionBuilder();

      expect(builder.condition(leaf('f', 'In', []))).toBe(
        '(attribute_exists(#n0) AND attribute_not_exists(#n0))',
      );
    });

    it('negates NotIn', () => {
      const builder = new ExpressionBuilder();

      expect(builder.condition(leaf('f', 'NotIn', ['a', 'b']))).toBe('NOT (#n0 IN (:v0, :v1))');
    });

    it('requires every value for IncludesAll', () => {
      const builder = new ExpressionBuilder();

      expect(builder.condition(leaf('tags', 'IncludesAll', ['a', 'b']))).toBe(
        '(contains(#n0, :v0) AND contains(#n0, :v1))',
      );
    });

    it('translates Blank as missing, NULL or empty', () => {
      const builder = new ExpressionBuilder();

      expect(builder.condition(leaf('f', 'Blank'))).toBe(
        '(attribute_not_exists(#n0) OR attribute_type(#n0, :v0) OR #n0 = :v1)',
      );
      expect(builder.values).toEqual({ ':v0': 'NULL', ':v1': '' });
    });

    it('translates Before and After on a date as comparisons on its ISO string', () => {
      const builder = new ExpressionBuilder();
      const date = new Date('2024-01-15T10:00:00.000Z');

      expect(builder.condition(leaf('at', 'Before', date))).toBe('#n0 < :v0');
      expect(builder.condition(leaf('at', 'After', date))).toBe('#n0 > :v1');
      expect(builder.values).toEqual({
        ':v0': '2024-01-15T10:00:00.000Z',
        ':v1': '2024-01-15T10:00:00.000Z',
      });
    });

    it('requires none of the values for IncludesNone', () => {
      const builder = new ExpressionBuilder();

      expect(builder.condition(leaf('tags', 'IncludesNone', ['a', 'b']))).toBe(
        '(NOT contains(#n0, :v0) AND NOT contains(#n0, :v1))',
      );
    });

    it('is always true for an empty IncludesAll or NotIn', () => {
      const builder = new ExpressionBuilder();

      expect(builder.condition(leaf('tags', 'IncludesAll', []))).toBe(
        '(attribute_exists(#n0) OR attribute_not_exists(#n0))',
      );
      expect(builder.condition(leaf('tags', 'NotIn', []))).toBe(
        '(attribute_exists(#n0) OR attribute_not_exists(#n0))',
      );
    });

    it('turns an In of null only into a missing check', () => {
      const builder = new ExpressionBuilder();

      expect(builder.condition(leaf('f', 'In', [null]))).toBe(
        '(attribute_not_exists(#n0) OR attribute_type(#n0, :v0))',
      );
    });

    it('negates a NotIn that is split in several groups as a whole', () => {
      const builder = new ExpressionBuilder();
      const values = Array.from({ length: 101 }, (_, i) => i);

      expect(builder.condition(leaf('f', 'NotIn', values)).startsWith('NOT (#n0 IN (')).toBe(true);
    });

    it('throws a typed error on an operator that cannot be pushed down', () => {
      const builder = new ExpressionBuilder();

      expect(() => builder.condition(leaf('f', 'ILike', '%a%'))).toThrow(
        'Operator "ILike" cannot be evaluated by DynamoDB',
      );
    });

    it('rejects a relation field', () => {
      const builder = new ExpressionBuilder();

      expect(() => builder.condition(leaf('rel:name', 'Equal', 'a'))).toThrow(
        'Filtering on the relation field "rel:name" is not supported',
      );
    });
  });

  describe('projection', () => {
    it('aliases the top-level attribute of nested fields once', () => {
      const builder = new ExpressionBuilder();

      expect(builder.projection(['pk', 'address->city', 'address->zip'])).toBe('#n0, #n1');
      expect(builder.names).toEqual({ '#n0': 'pk', '#n1': 'address' });
    });
  });

  describe('result', () => {
    it('omits empty alias maps', () => {
      expect(new ExpressionBuilder().result()).toEqual({});
    });

    it('returns names and values when used', () => {
      const builder = new ExpressionBuilder();
      builder.condition(leaf('f', 'Equal', 1));

      expect(builder.result()).toEqual({
        ExpressionAttributeNames: { '#n0': 'f' },
        ExpressionAttributeValues: { ':v0': 1 },
      });
    });
  });
});

describe('splitCondition', () => {
  it('leaves Present to the items, since the toolkit also excludes empty strings from it', () => {
    const tree = leaf('f', 'Present');

    const { pushable, residual } = splitCondition(tree);

    expect(pushable).toBeUndefined();
    expect(residual).toBe(tree);
  });

  it('returns everything as pushable when DynamoDB can evaluate it', () => {
    const tree = leaf('f', 'Equal', 1);

    const { pushable, residual } = splitCondition(tree);

    expect(pushable).toBe(tree);
    expect(residual).toBeUndefined();
  });

  it('keeps unsupported leaves of an AND as residual', () => {
    const tree = ConditionTreeFactory.fromPlainObject({
      aggregator: 'And',
      conditions: [
        { field: 'a', operator: 'Equal', value: 1 },
        { field: 'b', operator: 'ILike', value: '%x%' },
      ],
    });

    const { pushable, residual } = splitCondition(tree);

    expect(pushable.toPlainObject()).toEqual({ field: 'a', operator: 'Equal', value: 1 });
    expect(residual.toPlainObject()).toEqual({ field: 'b', operator: 'ILike', value: '%x%' });
  });

  it('sends a whole OR to the residual when one branch cannot be pushed down', () => {
    const tree = ConditionTreeFactory.fromPlainObject({
      aggregator: 'Or',
      conditions: [
        { field: 'a', operator: 'Equal', value: 1 },
        { field: 'b', operator: 'EndsWith', value: 'x' },
      ],
    });

    const { pushable, residual } = splitCondition(tree);

    expect(pushable).toBeUndefined();
    expect(residual).toBe(tree);
  });

  it('handles an absent tree', () => {
    expect(splitCondition(undefined)).toEqual({ pushable: undefined, residual: undefined });
  });
});
