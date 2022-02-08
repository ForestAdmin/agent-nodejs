import ConditionTreeBranch, { Aggregator } from '../../src/interfaces/query/condition-tree/branch';
import ConditionTreeFactory from '../../src/interfaces/query/condition-tree/factory';
import ConditionTreeLeaf, { Operator } from '../../src/interfaces/query/condition-tree/leaf';
import ConditionTreeNot from '../../src/interfaces/query/condition-tree/not';
import * as factories from '../__factories__';

describe('ConditionTree', () => {
  describe('Factory', () => {
    describe('intersect', () => {
      test('intersect() an empty list should return an empty And', () => {
        expect(ConditionTreeFactory.intersect()).toEqual({
          aggregator: Aggregator.And,
          conditions: [],
        });
      });

      test('intersect() should return the parameter when called with only one param', () => {
        const tree = ConditionTreeFactory.intersect(
          new ConditionTreeLeaf('column', Operator.Equal, true),
        );

        expect(tree).toEqual({ field: 'column', operator: Operator.Equal, value: true });
      });

      test('intersect() should ignore null params', () => {
        const tree = ConditionTreeFactory.intersect(
          null,
          new ConditionTreeLeaf('column', Operator.Equal, true),
          null,
        );

        expect(tree).toEqual({ field: 'column', operator: Operator.Equal, value: true });
      });

      test('intersect() multiple trees should return the tree', () => {
        const tree = ConditionTreeFactory.intersect(
          new ConditionTreeLeaf('column', Operator.Equal, true),
          new ConditionTreeLeaf('otherColumn', Operator.Equal, true),
        );

        expect(tree).toEqual({
          aggregator: Aggregator.And,
          conditions: [
            { field: 'column', operator: Operator.Equal, value: true },
            { field: 'otherColumn', operator: Operator.Equal, value: true },
          ],
        });
      });

      test('intersect() should merge And trees', () => {
        const tree = ConditionTreeFactory.intersect(
          new ConditionTreeBranch(Aggregator.And, [
            new ConditionTreeLeaf('column', Operator.Equal, true),
          ]),
          new ConditionTreeBranch(Aggregator.And, [
            new ConditionTreeLeaf('otherColumn', Operator.Equal, true),
          ]),
        );

        expect(tree).toEqual({
          aggregator: Aggregator.And,
          conditions: [
            { field: 'column', operator: Operator.Equal, value: true },
            { field: 'otherColumn', operator: Operator.Equal, value: true },
          ],
        });
      });
    });

    describe('matchRecords / matchIds', () => {
      describe('with a simple pk', () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              col1: factories.columnSchema.isPrimaryKey().build(),
            },
          }),
        });

        test('should generate equal', () => {
          const condition = ConditionTreeFactory.matchRecords(collection.schema, [{ col1: 1 }]);

          expect(condition).toEqual({ field: 'col1', operator: Operator.Equal, value: 1 });
        });

        test('should generate in', () => {
          const condition = ConditionTreeFactory.matchRecords(collection.schema, [
            { col1: 1 },
            { col1: 2 },
          ]);

          expect(condition).toEqual({ field: 'col1', operator: Operator.In, value: [1, 2] });
        });
      });

      describe('with a composite pk', () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              col1: factories.columnSchema.isPrimaryKey().build(),
              col2: factories.columnSchema.isPrimaryKey().build(),
              col3: factories.columnSchema.isPrimaryKey().build(),
            },
          }),
        });

        test('should generate a simple and', () => {
          const condition = ConditionTreeFactory.matchRecords(collection.schema, [
            { col1: 1, col2: 1, col3: 1 },
          ]);

          expect(condition).toEqual({
            aggregator: Aggregator.And,
            conditions: [
              { field: 'col1', operator: Operator.Equal, value: 1 },
              { field: 'col2', operator: Operator.Equal, value: 1 },
              { field: 'col3', operator: Operator.Equal, value: 1 },
            ],
          });
        });

        test('should factorize', () => {
          const condition = ConditionTreeFactory.matchRecords(collection.schema, [
            { col1: 1, col2: 1, col3: 1 },
            { col1: 1, col2: 1, col3: 2 },
          ]);

          expect(condition).toEqual({
            aggregator: Aggregator.And,
            conditions: [
              { field: 'col1', operator: Operator.Equal, value: 1 },
              { field: 'col2', operator: Operator.Equal, value: 1 },
              { field: 'col3', operator: Operator.In, value: [1, 2] },
            ],
          });
        });

        test('should not factorize', () => {
          const condition = ConditionTreeFactory.matchRecords(collection.schema, [
            { col1: 1, col2: 1, col3: 1 },
            { col1: 2, col2: 2, col3: 2 },
          ]);

          expect(condition).toEqual({
            aggregator: Aggregator.Or,
            conditions: [
              {
                aggregator: Aggregator.And,
                conditions: [
                  { field: 'col1', operator: Operator.Equal, value: 1 },
                  { field: 'col2', operator: Operator.Equal, value: 1 },
                  { field: 'col3', operator: Operator.Equal, value: 1 },
                ],
              },
              {
                aggregator: Aggregator.And,
                conditions: [
                  { field: 'col1', operator: Operator.Equal, value: 2 },
                  { field: 'col2', operator: Operator.Equal, value: 2 },
                  { field: 'col3', operator: Operator.Equal, value: 2 },
                ],
              },
            ],
          });
        });
      });
    });
  });

  describe('Methods', () => {
    const tree = new ConditionTreeBranch(Aggregator.And, [
      new ConditionTreeLeaf('column1', Operator.Equal, true),
      new ConditionTreeLeaf('column2', Operator.Equal, true),
      new ConditionTreeNot(new ConditionTreeLeaf('column2', Operator.Equal, false)),
    ]);

    test('apply() should work', () => {
      const records = [
        { id: 1, column1: true, column2: true },
        { id: 2, column1: false, column2: true },
        { id: 3, column1: true, column2: false },
      ];

      expect(tree.apply(records)).toStrictEqual([{ id: 1, column1: true, column2: true }]);
    });

    test('everyLeaf() should work', () => {
      expect(tree.everyLeaf(leaf => leaf.value === true)).toBe(false);
      expect(tree.everyLeaf(leaf => leaf.field === 'column1')).toBe(false);
      expect(tree.everyLeaf(leaf => leaf.field.startsWith('column'))).toBe(true);
    });

    test('forEachLeaf() should work', () => {
      const fn = jest.fn();

      tree.forEachLeaf(fn);
      expect(fn).toHaveBeenCalledTimes(3);
      expect(fn).toHaveBeenCalledWith(tree.conditions[0]);
      expect(fn).toHaveBeenCalledWith(tree.conditions[1]);
      expect(fn).toHaveBeenCalledWith((tree.conditions[2] as ConditionTreeNot).condition);
    });

    test('inverse() should work', () => {
      expect(tree.inverse()).toEqual({
        aggregator: Aggregator.Or,
        conditions: [
          { field: 'column1', operator: Operator.NotEqual, value: true },
          { field: 'column2', operator: Operator.NotEqual, value: true },
          { field: 'column2', operator: Operator.Equal, value: false },
        ],
      });

      expect(tree.inverse().inverse()).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column1', operator: Operator.Equal, value: true },
          { field: 'column2', operator: Operator.Equal, value: true },
          { field: 'column2', operator: Operator.NotEqual, value: false },
        ],
      });
    });

    test('inverse() should work with blank', () => {
      const blank = new ConditionTreeLeaf('column1', Operator.Blank);

      expect(blank.inverse()).toEqual({ field: 'column1', operator: Operator.Present });
      expect(blank.inverse().inverse()).toEqual(blank);
    });

    test('inverse() should use not with unsupported operator', () => {
      const today = new ConditionTreeLeaf('column1', Operator.Today);

      expect(today.inverse()).toEqual({
        condition: { field: 'column1', operator: Operator.Today },
      });
    });

    test('match() should work', () => {
      expect(tree.match({ column1: true, column2: true })).toBeTruthy();
      expect(tree.match({ column1: false, column2: true })).toBeFalsy();

      expect(tree.inverse().match({ column1: true, column2: true })).toBeFalsy();
      expect(tree.inverse().match({ column1: false, column2: true })).toBeTruthy();
    });

    test('match() should work with many operators', () => {
      const allConditions = new ConditionTreeBranch(Aggregator.And, [
        new ConditionTreeLeaf('string', Operator.Present),
        new ConditionTreeLeaf('string', Operator.Contains, 'value'),
        new ConditionTreeLeaf('string', Operator.StartsWith, 'value'),
        new ConditionTreeLeaf('string', Operator.EndsWith, 'value'),
        new ConditionTreeLeaf('string', Operator.LessThan, 'valuf'),
        new ConditionTreeLeaf('string', Operator.Equal, 'value'),
        new ConditionTreeLeaf('string', Operator.GreaterThan, 'valud'),
        new ConditionTreeLeaf('string', Operator.In, ['value']),
        new ConditionTreeLeaf('array', Operator.IncludesAll, ['value']),
        new ConditionTreeLeaf('string', Operator.LongerThan, 0),
        new ConditionTreeLeaf('string', Operator.ShorterThan, 999),
      ]);

      expect(allConditions.match({ string: 'value', array: ['value'] })).toBeTruthy();
    });

    test('match() should crash with unsupported operators', () => {
      const today = new ConditionTreeLeaf('column', Operator.Today);

      expect(() => today.match({})).toThrow("Unsupported operator: 'today'");
    });

    test('nest() should work', () => {
      expect(tree.nest('prefix')).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'prefix:column1', operator: Operator.Equal, value: true },
          { field: 'prefix:column2', operator: Operator.Equal, value: true },
          { condition: { field: 'prefix:column2', operator: Operator.Equal, value: false } },
        ],
      });
    });

    test('unnest() should work', () => {
      expect(tree.nest('prefix').unnest()).toEqual(tree);
    });

    test('unnest() should throw', () => {
      expect(() => tree.unnest()).toThrow('Cannot unnest condition tree.');
    });

    test('projection() should work', () => {
      expect(tree.projection).toEqual(['column1', 'column2']);
    });

    test('replaceFields() should work', () => {
      expect(tree.replaceFields(field => `${field}:suffix`)).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column1:suffix', operator: Operator.Equal, value: true },
          { field: 'column2:suffix', operator: Operator.Equal, value: true },
          { condition: { field: 'column2:suffix', operator: Operator.Equal, value: false } },
        ],
      });
    });

    test('replaceLeafs() should work when returning leaf instance', () => {
      expect(tree.replaceLeafs(leaf => leaf.override({ value: !leaf.value }))).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column1', operator: Operator.Equal, value: false },
          { field: 'column2', operator: Operator.Equal, value: false },
          { condition: { field: 'column2', operator: Operator.Equal, value: true } },
        ],
      });
    });

    test('replaceLeafs() should work when returning plain object', () => {
      expect(tree.replaceLeafs(leaf => ({ ...leaf, value: !leaf.value }))).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column1', operator: Operator.Equal, value: false },
          { field: 'column2', operator: Operator.Equal, value: false },
          { condition: { field: 'column2', operator: Operator.Equal, value: true } },
        ],
      });
    });

    test('replaceLeafsAsync() should work when returning leaf instance', async () => {
      expect(
        await tree.replaceLeafsAsync(async leaf => leaf.override({ value: !leaf.value })),
      ).toEqual({
        aggregator: Aggregator.And,
        conditions: [
          { field: 'column1', operator: Operator.Equal, value: false },
          { field: 'column2', operator: Operator.Equal, value: false },
          { condition: { field: 'column2', operator: Operator.Equal, value: true } },
        ],
      });
    });

    test('replaceLeafsAsync() should work when returning plain object', async () => {
      expect(await tree.replaceLeafsAsync(async leaf => ({ ...leaf, value: !leaf.value }))).toEqual(
        {
          aggregator: Aggregator.And,
          conditions: [
            { field: 'column1', operator: Operator.Equal, value: false },
            { field: 'column2', operator: Operator.Equal, value: false },
            { condition: { field: 'column2', operator: Operator.Equal, value: true } },
          ],
        },
      );
    });

    test('someLeaf() should work', () => {
      expect(tree.someLeaf(leaf => leaf.value === true)).toBe(true);
      expect(tree.someLeaf(leaf => leaf.field === 'column1')).toBe(true);
      expect(tree.someLeaf(leaf => leaf.field.startsWith('something'))).toBe(false);
    });
  });
});
