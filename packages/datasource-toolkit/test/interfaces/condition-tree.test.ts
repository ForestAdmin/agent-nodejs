import * as factories from '../__factories__';
import { PlainConditionTree } from '../../src/interfaces/query/condition-tree/nodes/base';
import ConditionTreeBranch from '../../src/interfaces/query/condition-tree/nodes/branch';
import ConditionTreeFactory from '../../src/interfaces/query/condition-tree/factory';
import ConditionTreeLeaf from '../../src/interfaces/query/condition-tree/nodes/leaf';

describe('ConditionTree', () => {
  describe('Factory', () => {
    describe('intersect', () => {
      test('intersect() an empty list should return null', () => {
        expect(ConditionTreeFactory.intersect()).toBe(null);
      });

      test('intersect() should return the parameter when called with only one param', () => {
        const tree = ConditionTreeFactory.intersect(new ConditionTreeLeaf('column', 'Equal', true));

        expect(tree).toEqual({ field: 'column', operator: 'Equal', value: true });
      });

      test('intersect() should ignore null params', () => {
        const tree = ConditionTreeFactory.intersect(
          null,
          new ConditionTreeLeaf('column', 'Equal', true),
          null,
        );

        expect(tree).toEqual({ field: 'column', operator: 'Equal', value: true });
      });

      test('intersect() multiple trees should return the tree', () => {
        const tree = ConditionTreeFactory.intersect(
          new ConditionTreeLeaf('column', 'Equal', true),
          new ConditionTreeLeaf('otherColumn', 'Equal', true),
        );

        expect(tree).toEqual({
          aggregator: 'And',
          conditions: [
            { field: 'column', operator: 'Equal', value: true },
            { field: 'otherColumn', operator: 'Equal', value: true },
          ],
        });
      });

      test('intersect() should merge And trees', () => {
        const tree = ConditionTreeFactory.intersect(
          new ConditionTreeBranch('And', [new ConditionTreeLeaf('column', 'Equal', true)]),
          new ConditionTreeBranch('And', [new ConditionTreeLeaf('otherColumn', 'Equal', true)]),
        );

        expect(tree).toEqual({
          aggregator: 'And',
          conditions: [
            { field: 'column', operator: 'Equal', value: true },
            { field: 'otherColumn', operator: 'Equal', value: true },
          ],
        });
      });
    });

    describe('matchRecords / matchIds', () => {
      describe('with a collection with no pk', () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              col1: factories.columnSchema.build({}),
            },
          }),
        });

        test('should raise error', () => {
          const fn = () => ConditionTreeFactory.matchIds(collection.schema, [[]]);
          expect(fn).toThrow('Collection must have at least one primary key');
        });
      });

      describe('with a collection which does not support equal and in', () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              col1: factories.columnSchema.uuidPrimaryKey().build({
                filterOperators: null,
              }),
            },
          }),
        });

        test('should raise error', () => {
          const fn = () => ConditionTreeFactory.matchRecords(collection.schema, [{ col1: 1 }]);

          expect(fn).toThrow("Field 'col1' must support operators: ['Equal', 'In']");
        });
      });

      describe('with a simple pk', () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              col1: factories.columnSchema.uuidPrimaryKey().build(),
            },
          }),
        });

        test('should generate matchNone', () => {
          const condition = ConditionTreeFactory.matchRecords(collection.schema, []);

          expect(condition).toEqual(ConditionTreeFactory.MatchNone);
        });

        test('should generate equal', () => {
          const condition = ConditionTreeFactory.matchRecords(collection.schema, [{ col1: 1 }]);

          expect(condition).toEqual({ field: 'col1', operator: 'Equal', value: 1 });
        });

        test('should generate in', () => {
          const condition = ConditionTreeFactory.matchRecords(collection.schema, [
            { col1: 1 },
            { col1: 2 },
          ]);

          expect(condition).toEqual({ field: 'col1', operator: 'In', value: [1, 2] });
        });
      });

      describe('with a composite pk', () => {
        const collection = factories.collection.build({
          schema: factories.collectionSchema.build({
            fields: {
              col1: factories.columnSchema.uuidPrimaryKey().build(),
              col2: factories.columnSchema.uuidPrimaryKey().build(),
              col3: factories.columnSchema.uuidPrimaryKey().build(),
            },
          }),
        });

        test('should generate a simple and', () => {
          const condition = ConditionTreeFactory.matchRecords(collection.schema, [
            { col1: 1, col2: 1, col3: 1 },
          ]);

          expect(condition).toEqual({
            aggregator: 'And',
            conditions: [
              { field: 'col1', operator: 'Equal', value: 1 },
              { field: 'col2', operator: 'Equal', value: 1 },
              { field: 'col3', operator: 'Equal', value: 1 },
            ],
          });
        });

        test('should factorize', () => {
          const condition = ConditionTreeFactory.matchRecords(collection.schema, [
            { col1: 1, col2: 1, col3: 1 },
            { col1: 1, col2: 1, col3: 2 },
          ]);

          expect(condition).toEqual({
            aggregator: 'And',
            conditions: [
              { field: 'col1', operator: 'Equal', value: 1 },
              { field: 'col2', operator: 'Equal', value: 1 },
              { field: 'col3', operator: 'In', value: [1, 2] },
            ],
          });
        });

        test('should not factorize', () => {
          const condition = ConditionTreeFactory.matchRecords(collection.schema, [
            { col1: 1, col2: 1, col3: 1 },
            { col1: 2, col2: 2, col3: 2 },
          ]);

          expect(condition).toEqual({
            aggregator: 'Or',
            conditions: [
              {
                aggregator: 'And',
                conditions: [
                  { field: 'col1', operator: 'Equal', value: 1 },
                  { field: 'col2', operator: 'Equal', value: 1 },
                  { field: 'col3', operator: 'Equal', value: 1 },
                ],
              },
              {
                aggregator: 'And',
                conditions: [
                  { field: 'col1', operator: 'Equal', value: 2 },
                  { field: 'col2', operator: 'Equal', value: 2 },
                  { field: 'col3', operator: 'Equal', value: 2 },
                ],
              },
            ],
          });
        });
      });
    });

    describe('fromPlainObject', () => {
      test('should crash when calling with badly formatted json', () => {
        const fn = () =>
          ConditionTreeFactory.fromPlainObject('this is not json' as unknown as PlainConditionTree);
        expect(fn).toThrow('Failed to instantiate condition tree from json');
      });

      test('should work with a simple case', () => {
        const tree = ConditionTreeFactory.fromPlainObject({
          field: 'field',
          operator: 'Equal',
          value: 'something',
        });

        expect(tree).toStrictEqual(new ConditionTreeLeaf('field', 'Equal', 'something'));
      });

      test('should remove useless aggregators from the frontend', () => {
        const tree = ConditionTreeFactory.fromPlainObject({
          aggregator: 'And',
          conditions: [{ field: 'field', operator: 'Equal', value: 'something' }],
        });

        expect(tree).toStrictEqual(new ConditionTreeLeaf('field', 'Equal', 'something'));
      });

      test('should work with an aggregator', () => {
        const tree = ConditionTreeFactory.fromPlainObject({
          aggregator: 'And',
          conditions: [
            { field: 'field', operator: 'Equal', value: 'something' },
            { field: 'field', operator: 'Equal', value: 'something' },
          ],
        });

        expect(tree).toStrictEqual(
          new ConditionTreeBranch('And', [
            new ConditionTreeLeaf('field', 'Equal', 'something'),
            new ConditionTreeLeaf('field', 'Equal', 'something'),
          ]),
        );
      });
    });
  });

  describe('Methods', () => {
    const tree = new ConditionTreeBranch('And', [
      new ConditionTreeLeaf('column1', 'Equal', true),
      new ConditionTreeLeaf('column2', 'Equal', true),
    ]);

    test('apply() should work', () => {
      const collection = factories.collection.build({
        schema: factories.collectionSchema.build({
          fields: {
            column1: factories.columnSchema.build({ columnType: 'Boolean' }),
            column2: factories.columnSchema.build({ columnType: 'Boolean' }),
          },
        }),
      });

      const records = [
        { id: 1, column1: true, column2: true },
        { id: 2, column1: false, column2: true },
        { id: 3, column1: true, column2: false },
      ];

      expect(tree.apply(records, collection, 'Europe/Paris')).toStrictEqual([
        { id: 1, column1: true, column2: true },
      ]);
    });

    test('everyLeaf() should work', () => {
      expect(tree.everyLeaf(leaf => leaf.field === 'column1')).toBe(false);
    });

    test('forEachLeaf() should work', () => {
      const fn = jest.fn();

      tree.forEachLeaf(fn);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledWith(tree.conditions[0]);
      expect(fn).toHaveBeenCalledWith(tree.conditions[1]);
    });

    test('inverse() should work', () => {
      expect(tree.inverse()).toEqual({
        aggregator: 'Or',
        conditions: [
          { field: 'column1', operator: 'NotEqual', value: true },
          { field: 'column2', operator: 'NotEqual', value: true },
        ],
      });

      expect(tree.inverse().inverse()).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column1', operator: 'Equal', value: true },
          { field: 'column2', operator: 'Equal', value: true },
        ],
      });
    });

    test('inverse() should work with blank', () => {
      const blank = new ConditionTreeLeaf('column1', 'Blank');

      expect(blank.inverse()).toEqual({ field: 'column1', operator: 'Present' });
      expect(blank.inverse().inverse()).toEqual(blank);
    });

    test('inverse() should crash with unsupported operator', () => {
      const today = new ConditionTreeLeaf('column1', 'Today');

      expect(() => today.inverse()).toThrow("Operator 'Today' cannot be inverted.");
    });

    test('match() should work', () => {
      const collection = factories.collection.build({
        schema: factories.collectionSchema.build({
          fields: {
            column1: factories.columnSchema.build({ columnType: 'Boolean' }),
            column2: factories.columnSchema.build({ columnType: 'Boolean' }),
          },
        }),
      });

      expect(tree.match({ column1: true, column2: true }, collection, 'Europe/Paris')).toBeTruthy();
      expect(tree.match({ column1: false, column2: true }, collection, 'Europe/Paris')).toBeFalsy();
      expect(
        tree.inverse().match({ column1: true, column2: true }, collection, 'Europe/Paris'),
      ).toBeFalsy();

      expect(
        tree.inverse().match({ column1: false, column2: true }, collection, 'Europe/Paris'),
      ).toBeTruthy();
    });

    test('match() should work with many operators', () => {
      const collection = factories.collection.build({
        schema: factories.collectionSchema.build({
          fields: {
            string: factories.columnSchema.build({ columnType: 'String' }),
            array: factories.columnSchema.build({ columnType: ['String'] }),
          },
        }),
      });
      const allConditions = new ConditionTreeBranch('And', [
        new ConditionTreeLeaf('string', 'Present'),
        new ConditionTreeLeaf('string', 'Like', '%value%'),
        new ConditionTreeLeaf('string', 'ILike', '%VaLuE%'),
        new ConditionTreeLeaf('string', 'LessThan', 'valuf'),
        new ConditionTreeLeaf('string', 'Equal', 'value'),
        new ConditionTreeLeaf('string', 'GreaterThan', 'valud'),
        new ConditionTreeLeaf('string', 'In', ['value']),
        new ConditionTreeLeaf('array', 'IncludesAll', ['value']),
        new ConditionTreeLeaf('string', 'LongerThan', 0),
        new ConditionTreeLeaf('string', 'ShorterThan', 999),
      ]);

      expect(
        allConditions.match({ string: 'value', array: ['value'] }, collection, 'Europe/Paris'),
      ).toBeTruthy();
    });

    test('nest() should work', () => {
      expect(tree.nest('prefix')).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'prefix:column1', operator: 'Equal', value: true },
          { field: 'prefix:column2', operator: 'Equal', value: true },
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
        aggregator: 'And',
        conditions: [
          { field: 'column1:suffix', operator: 'Equal', value: true },
          { field: 'column2:suffix', operator: 'Equal', value: true },
        ],
      });
    });

    test('replaceLeafs() should work when returning leaf instance', () => {
      expect(tree.replaceLeafs(leaf => leaf.override({ value: !leaf.value }))).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column1', operator: 'Equal', value: false },
          { field: 'column2', operator: 'Equal', value: false },
        ],
      });
    });

    test('replaceLeafs() should work when returning plain object', () => {
      expect(tree.replaceLeafs(leaf => ({ ...leaf, value: !leaf.value }))).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column1', operator: 'Equal', value: false },
          { field: 'column2', operator: 'Equal', value: false },
        ],
      });
    });

    test('replaceLeafsAsync() should work when returning leaf instance', async () => {
      expect(
        await tree.replaceLeafsAsync(async leaf => leaf.override({ value: !leaf.value })),
      ).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'column1', operator: 'Equal', value: false },
          { field: 'column2', operator: 'Equal', value: false },
        ],
      });
    });

    test('replaceLeafsAsync() should work when returning plain object', async () => {
      expect(await tree.replaceLeafsAsync(async leaf => ({ ...leaf, value: !leaf.value }))).toEqual(
        {
          aggregator: 'And',
          conditions: [
            { field: 'column1', operator: 'Equal', value: false },
            { field: 'column2', operator: 'Equal', value: false },
          ],
        },
      );
    });

    test('someLeaf() should work', () => {
      expect(tree.someLeaf(leaf => leaf.value === true)).toBe(true);
      expect(tree.someLeaf(leaf => leaf.field === 'column1')).toBe(true);
      expect(tree.someLeaf(leaf => leaf.field.startsWith('something'))).toBe(false);
    });

    describe('useIntervalOperator()', () => {
      test('should return true', () => {
        const leaf = new ConditionTreeLeaf('column', 'Today', true);
        expect(leaf.useIntervalOperator).toBe(true);
      });

      test('should return false', () => {
        const leaf = new ConditionTreeLeaf('column', 'Equal', true);
        expect(leaf.useIntervalOperator).toBe(false);
      });
    });
  });
});
