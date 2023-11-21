/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Aggregator,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Operator,
  Sort,
} from '@forestadmin/datasource-toolkit';

import QueryConverter from '../../src/utils/query-converter';

describe('Utils > QueryConverter', () => {
  describe('getBoolQueryFromConditionTree', () => {
    describe('with a condition tree acting on relation', () => {
      it('should throw', async () => {
        const conditionTree = new ConditionTreeLeaf('relation:__field__', 'Equal', '__value__');

        const queryConverter = new QueryConverter();
        expect(() => queryConverter.getBoolQueryFromConditionTree(conditionTree)).toThrow(
          'Unsupported relation ConditionTree.',
        );
      });
    });

    describe('with a condition tree without relation', () => {
      it('should generate a valid query clause', async () => {
        const conditionTree = new ConditionTreeLeaf('__field_1__', 'Equal', '__value__');

        const queryConverter = new QueryConverter();
        const query = await queryConverter.getBoolQueryFromConditionTree(conditionTree);

        expect(query).toEqual({ terms: { __field_1__: ['__value__'] } });
      });
    });

    describe('without condition tree', () => {
      it('should generate a valid match_all query', async () => {
        const queryConverter = new QueryConverter();
        const query = await queryConverter.getBoolQueryFromConditionTree(undefined);

        expect(query).toEqual({ match_all: {} });
      });
    });

    it('should fail with an invalid conditionTree', () => {
      const conditionTree = {
        operator: undefined,
      } as unknown as ConditionTreeBranch;

      const queryConverter = new QueryConverter();

      expect(() => queryConverter.getBoolQueryFromConditionTree(conditionTree)).toThrow(
        'Invalid ConditionTree.',
      );
    });

    describe('with a condition tree', () => {
      describe('when a null condition tree is given', () => {
        it('should return a valid match_all query', () => {
          const queryConverter = new QueryConverter();

          expect(
            queryConverter.getBoolQueryFromConditionTree(null as unknown as ConditionTree),
          ).toEqual({ match_all: {} });
        });
      });

      describe('with a ConditionTreeBranch node', () => {
        it('should fail when aggregator is empty', () => {
          const conditionTree = new ConditionTreeBranch(null as unknown as Aggregator, [
            new ConditionTreeLeaf('__field__', 'Equal', '__value__'),
            new ConditionTreeLeaf('__field__', 'Equal', '__value__'),
          ]);

          const queryConverter = new QueryConverter();

          expect(() => queryConverter.getBoolQueryFromConditionTree(conditionTree)).toThrow(
            'Invalid (null) aggregator.',
          );
        });

        it('should throw an error when conditions is not an array', () => {
          const conditionTree = new ConditionTreeBranch('And', null as never);

          const queryConverter = new QueryConverter();

          expect(() => queryConverter.getBoolQueryFromConditionTree(conditionTree)).toThrow(
            'Conditions must be an array.',
          );
        });

        it('should not throw an error when there is no condition', () => {
          const conditionTree = new ConditionTreeBranch('And', []);

          const queryConverter = new QueryConverter();

          expect(() => queryConverter.getBoolQueryFromConditionTree(conditionTree)).not.toThrow();
        });

        describe('with only one condition', () => {
          it('should not throw an error with the And aggregator', () => {
            const conditionTree = new ConditionTreeBranch('And', [
              new ConditionTreeLeaf('__field_1__', 'Equal', '__value_1__'),
            ]);
            const queryConverter = new QueryConverter();
            expect(() => queryConverter.getBoolQueryFromConditionTree(conditionTree)).not.toThrow();
          });

          it('should not throw an error with the Or aggregator', () => {
            const conditionTree = new ConditionTreeBranch('Or', [
              new ConditionTreeLeaf('__field_1__', 'Equal', '__value_1__'),
            ]);
            const queryConverter = new QueryConverter();
            expect(() => queryConverter.getBoolQueryFromConditionTree(conditionTree)).not.toThrow();
          });
        });

        it.each([
          ['And', 'must'],
          ['Or', 'should'],
        ])('should generate a "%s bool" filter from conditions', (aggregator, operator) => {
          const conditions = [
            new ConditionTreeLeaf('__field_1__', 'Equal', '__value_1__'),
            new ConditionTreeLeaf('__field_2__', 'Equal', '__value_2__'),
          ];

          const conditionTree = new ConditionTreeBranch(aggregator as Aggregator, conditions);
          const queryConverter = new QueryConverter();
          expect(queryConverter.getBoolQueryFromConditionTree(conditionTree)).toEqual({
            bool: {
              [operator]: [
                { terms: { [conditions[0].field]: [conditions[0].value] } },
                { terms: { [conditions[1].field]: [conditions[1].value] } },
              ],
            },
          });
        });
      });

      describe('with a ConditionTreeLeaf node', () => {
        const simpleArrayValue = [21, 42, 84];
        const arrayValueWithNull = [21, 42, null, 84];
        const integerValue = 42;
        const stringValue = 'VaLuE';

        it.each([
          ['Equal', integerValue, { terms: { __field_1__: [integerValue] } }],
          ['Equal', null, { bool: { must_not: [{ exists: { field: '__field_1__' } }] } }],
          ['LessThan', integerValue, { range: { __field_1__: { lt: integerValue } } }],
          ['GreaterThan', integerValue, { range: { __field_1__: { gt: integerValue } } }],
          ['In', [null], { bool: { must_not: [{ exists: { field: '__field_1__' } }] } }],
          ['In', [null, 2], { terms: { __field_1__: [null, 2] } }],
          ['In', simpleArrayValue, { terms: { __field_1__: simpleArrayValue } }],
          ['In', arrayValueWithNull, { terms: { __field_1__: arrayValueWithNull } }],
          ['In', [integerValue], { terms: { __field_1__: [integerValue] } }],
          ['IncludesAll', simpleArrayValue, { terms: { __field_1__: simpleArrayValue } }],

          ['Present', undefined, { exists: { field: '__field_1__' } }],
          [
            'Missing',
            undefined,
            {
              bool: {
                must_not: {
                  exists: {
                    field: '__field_1__',
                  },
                },
              },
            },
          ],

          [
            'NotEqual',
            integerValue,
            { bool: { must_not: { terms: { __field_1__: [integerValue] } } } },
          ],
          ['NotIn', [2], { bool: { must_not: { terms: { __field_1__: [2] } } } }],
          ['NotIn', [null], { bool: { must_not: { terms: { __field_1__: [null] } } } }],
          [
            'NotIn',
            simpleArrayValue,
            { bool: { must_not: { terms: { __field_1__: simpleArrayValue } } } },
          ],
          [
            'NotIn',
            arrayValueWithNull,
            { bool: { must_not: { terms: { __field_1__: arrayValueWithNull } } } },
          ],
          [
            'NotContains',
            stringValue,
            {
              bool: {
                must_not: {
                  wildcard: {
                    __field_1__: { value: '*VaLuE*', case_insensitive: true },
                  },
                },
              },
            },
          ],

          [
            'Like',
            stringValue,
            {
              regexp: {
                __field_1__: { value: 'VaLuE', case_insensitive: false, flags: 'NONE' },
              },
            },
          ],
          [
            'Like',
            `${stringValue}%`,
            {
              regexp: {
                __field_1__: { value: 'VaLuE.*', case_insensitive: false, flags: 'NONE' },
              },
            },
          ],
          [
            'Like',
            integerValue,
            {
              regexp: {
                __field_1__: { value: '42', case_insensitive: false, flags: 'NONE' },
              },
            },
          ],
          [
            'ILike',
            stringValue,
            {
              regexp: {
                __field_1__: { value: 'VaLuE', case_insensitive: true, flags: 'NONE' },
              },
            },
          ],
          [
            'ILike',
            'to%to.*',
            {
              regexp: {
                __field_1__: { value: 'to%to\\.\\*', case_insensitive: true, flags: 'NONE' },
              },
            },
          ],
        ])(
          'should generate a "boolean query" QueryDsl from a "%s" operator',
          (operator, value, expectedQuery) => {
            const conditionTree = new ConditionTreeLeaf('__field_1__', operator as Operator, value);

            const queryConverter = new QueryConverter();
            const query = queryConverter.getBoolQueryFromConditionTree(conditionTree);

            expect(query).toEqual(expectedQuery);
          },
        );

        it('should fail with an invalid operator', () => {
          const queryConverter = new QueryConverter();

          expect(() =>
            queryConverter.getBoolQueryFromConditionTree(
              new ConditionTreeLeaf('__field_1__', '__invalid__' as Operator, '__value__'),
            ),
          ).toThrow('Unsupported operator: "__invalid__".');
        });
      });
    });
  });

  describe('getOrderFromSort', () => {
    it('should omit the "order" clause when condition list is empty', () => {
      const queryConverter = new QueryConverter();

      expect(queryConverter.getOrderFromSort(new Sort())).toEqual([]);
    });

    it('should honor values from "sort"', () => {
      const sort = new Sort(
        { field: '__a__', ascending: true },
        { field: '__b__', ascending: false },
      );
      const queryConverter = new QueryConverter();

      expect(queryConverter.getOrderFromSort(sort)).toEqual([
        { __a__: { order: 'asc' } },
        { __b__: { order: 'desc' } },
      ]);
    });
  });
});
