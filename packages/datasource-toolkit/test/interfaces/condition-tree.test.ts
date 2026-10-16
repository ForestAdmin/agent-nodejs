import type { PlainConditionTree } from '../../src/interfaces/query/condition-tree/nodes/base';

import ConditionTreeFactory from '../../src/interfaces/query/condition-tree/factory';
import ConditionTreeBranch from '../../src/interfaces/query/condition-tree/nodes/branch';
import ConditionTreeLeaf from '../../src/interfaces/query/condition-tree/nodes/leaf';
import CollectionUtils from '../../src/utils/collection';
import RecordUtils from '../../src/utils/record';
import * as factories from '../__factories__';

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
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
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
              col1: factories.columnSchema.uuidPrimaryKey().build({ filterOperators: undefined }),
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
            number: factories.columnSchema.build({ columnType: 'Number' }),
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
        new ConditionTreeLeaf('string', 'StartsWith', 'valu'),
        new ConditionTreeLeaf('string', 'EndsWith', 'alue'),
        new ConditionTreeLeaf('number', 'GreaterThan', 9),
        new ConditionTreeLeaf('number', 'LessThan', 11),
        new ConditionTreeLeaf('number', 'GreaterThanOrEqual', 10),
        new ConditionTreeLeaf('number', 'LessThanOrEqual', 10),
      ]);

      expect(
        allConditions.match(
          { number: 10, string: 'value', array: ['value'] },
          collection,
          'Europe/Paris',
        ),
      ).toBeTruthy();
    });

    describe('apply()', () => {
      const collection = factories.collection.build({
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
            title: factories.columnSchema.build({ columnType: 'String' }),
            price: factories.columnSchema.build({ columnType: 'Number' }),
            tags: factories.columnSchema.build({ columnType: ['String'] }),
            publishedAt: factories.columnSchema.build({ columnType: 'Date' }),
          },
        }),
      });
      const records = [
        { id: 1, title: 'Alpha', price: 10, tags: ['a', 'b'], publishedAt: '2026-10-15T08:00:00Z' },
        { id: 2, title: 'beta', price: 20, tags: ['b'], publishedAt: '2026-10-14T08:00:00Z' },
        { id: 3, title: 'ALPHABET', price: null, tags: [], publishedAt: '2026-10-01T08:00:00Z' },
        { id: 4, title: null, price: 30, tags: null, publishedAt: null },
        {
          id: 5,
          title: 'alphanumeric',
          price: 10,
          tags: ['c'],
          publishedAt: '2026-09-15T08:00:00Z',
        },
      ];

      beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00.000Z') }));
      afterEach(() => jest.useRealTimers());

      test.each([
        ['title', 'Present', undefined, [1, 2, 3, 5]],
        ['title', 'Blank', undefined, [4]],
        ['title', 'Missing', undefined, [4]],
        ['title', 'Equal', 'beta', [2]],
        ['title', 'NotEqual', 'beta', [1, 3, 4, 5]],
        ['price', 'LessThan', 20, [1, 3, 5]],
        ['price', 'GreaterThan', 10, [2, 4]],
        ['price', 'LessThanOrEqual', 20, [1, 2, 3, 5]],
        ['price', 'GreaterThanOrEqual', 20, [2, 4]],
        ['price', 'In', [10, 30], [1, 4, 5]],
        ['price', 'NotIn', [10], [2, 3, 4]],
        ['title', 'Like', '%pha%', [1, 5]],
        ['title', 'ILike', '%PHA%', [1, 3, 5]],
        ['title', 'Contains', 'pha', [1, 5]],
        ['title', 'NotContains', 'pha', [2, 3, 4]],
        ['title', 'IContains', 'alpha', [1, 3, 5]],
        ['title', 'NotIContains', 'alpha', [2, 4]],
        ['title', 'StartsWith', 'Al', [1]],
        ['title', 'IStartsWith', 'al', [1, 3, 5]],
        ['title', 'EndsWith', 'ta', [2]],
        ['title', 'IEndsWith', 'BET', [3]],
        ['title', 'LongerThan', 5, [3, 5]],
        ['title', 'ShorterThan', 6, [1, 2]],
        ['tags', 'IncludesAll', ['b'], [1, 2]],
        ['tags', 'IncludesNone', ['b'], [3, 4, 5]],
        ['publishedAt', 'Today', undefined, [1]],
        ['publishedAt', 'Yesterday', undefined, [2]],
        ['publishedAt', 'Past', undefined, [1, 2, 3, 5]],
        ['publishedAt', 'PreviousXDays', 7, [2]],
        ['publishedAt', 'PreviousMonth', undefined, [5]],
        ['publishedAt', 'BeforeXHoursAgo', 5, [2, 3, 5]],
        ['publishedAt', 'AfterXHoursAgo', 5, [1]],
      ] as const)('should keep the right records for %s %s %j', (field, operator, value, ids) => {
        const leaf = new ConditionTreeLeaf(field, operator, value);

        expect(leaf.apply(records, collection, 'Europe/Paris').map(r => r.id)).toEqual(ids);
      });

      test.each([
        ['IContains', 'a_b', ['a_b']],
        ['IContains', '50%', ['50%']],
        ['IContains', 'a(b', ['a(b']],
        ['IContains', 'a.b', ['a.b']],
        ['Contains', 'A_B', []],
        ['IStartsWith', 'a_', ['a_b']],
        ['IEndsWith', '%', ['50%']],
      ] as const)('should match %s %j literally', (operator, value, titles) => {
        const literals = ['a_b', 'axb', '50%', '500', 'a(b', 'a.b', 'acb'].map(title => ({
          title,
        }));

        expect(
          new ConditionTreeLeaf('title', operator, value)
            .apply(literals, collection, 'Europe/Paris')
            .map(r => r.title),
        ).toEqual(titles);
      });

      test('should keep every record matching a pattern, however many match in a row', () => {
        const alphas = [{ title: 'alpha' }, { title: 'alpha' }, { title: 'alpha' }];

        expect(
          new ConditionTreeLeaf('title', 'Like', 'alpha').apply(alphas, collection, 'Europe/Paris'),
        ).toEqual(alphas);
      });

      test.each([/alpha/g, /alpha/y])(
        'should keep every record matching %s, however many match in a row',
        regExp => {
          const alphas = [{ title: 'alpha' }, { title: 'alpha' }, { title: 'alpha' }];

          expect(
            new ConditionTreeLeaf('title', 'Match', regExp).apply(
              alphas,
              collection,
              'Europe/Paris',
            ),
          ).toEqual(alphas);
        },
      );

      test('should match a condition built without createMatcher', () => {
        const foreignCondition = {
          match: (record: { id: number }) => record.id < 3,
        } as unknown as ConditionTreeLeaf;
        const filterTree = new ConditionTreeBranch('And', [foreignCondition]);

        expect(filterTree.apply(records, collection, 'Europe/Paris').map(r => r.id)).toEqual([
          1, 2,
        ]);
      });

      test.each(['NotContains', 'IContains'] as const)(
        'should read the field of each record once with %s',
        operator => {
          const getFieldValue = jest.spyOn(RecordUtils, 'getFieldValue');
          const leaf = new ConditionTreeLeaf('title', operator, 'alpha');

          leaf.apply(records, collection, 'Europe/Paris');
          const calls = getFieldValue.mock.calls.length;
          getFieldValue.mockRestore();

          expect(calls).toBe(records.length);
        },
      );

      test('should resolve the field schema the same number of times whatever the record count', () => {
        const filterTree = new ConditionTreeBranch('And', [
          new ConditionTreeLeaf('title', 'IContains', 'alpha'),
          new ConditionTreeLeaf('price', 'NotIn', [20]),
        ]);
        const getFieldSchema = jest.spyOn(CollectionUtils, 'getFieldSchema');

        const callsFor = (count: number) => {
          getFieldSchema.mockClear();
          filterTree.apply(
            Array.from({ length: count }, () => records[0]),
            collection,
            'Europe/Paris',
          );

          return getFieldSchema.mock.calls.length;
        };

        const callsForOneRecord = callsFor(1);
        const callsForFiftyRecords = callsFor(50);
        getFieldSchema.mockRestore();

        expect(callsForFiftyRecords).toBe(callsForOneRecord);
      });

      test('should not resolve an unknown field when there is no record', () => {
        const leaf = new ConditionTreeLeaf('unknown', 'IContains', 'alpha');

        expect(leaf.apply([], collection, 'Europe/Paris')).toEqual([]);
      });

      test('should not resolve a condition that the aggregator never reaches', () => {
        const filterTree = new ConditionTreeBranch('Or', [
          new ConditionTreeLeaf('id', 'Present'),
          new ConditionTreeLeaf('unknown', 'IContains', 'alpha'),
        ]);

        expect(filterTree.apply(records, collection, 'Europe/Paris').map(r => r.id)).toEqual([
          1, 2, 3, 4, 5,
        ]);
      });
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
