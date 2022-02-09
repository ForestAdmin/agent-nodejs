import { Op } from 'sequelize';
import {
  Aggregator,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  ConditionTreeNot,
  Filter,
  Operator,
  Page,
  PaginatedFilter,
  Sort,
} from '@forestadmin/datasource-toolkit';

import FilterConverter from '../../src/utils/filter-converter';

describe('Utils > FilterConverter', () => {
  describe('convertFilterToSequelize', () => {
    it('should fail with a null filter', () => {
      expect(() => FilterConverter.convertFilterToSequelize(null)).toThrow(
        'Invalid (null) filter.',
      );
    });

    it.each([
      ['a missing', new Filter({})],
      ['a null', new Filter({ conditionTree: null })],
      ['an undefined', new Filter({ conditionTree: undefined })],
    ])('should omit the "where" Sequelize clause with %s conditionTree', (message, filter) => {
      const sequelizeFilter = FilterConverter.convertFilterToSequelize(filter);

      expect(sequelizeFilter).not.toContain({ where: expect.anything() });
    });

    it('should fail with an invalid conditionTree', () => {
      const filter = new Filter({
        conditionTree: {
          operator: undefined,
        } as unknown as ConditionTreeBranch,
      });

      expect(() => FilterConverter.convertFilterToSequelize(filter)).toThrow(
        'Invalid ConditionTree.',
      );
    });

    describe('with a condition tree', () => {
      describe('with a ConditionTreeBranch node', () => {
        it('should fail when aggregator is empty', () => {
          const conditionTree = new ConditionTreeBranch(null, [
            new ConditionTreeLeaf({
              operator: Operator.Equal,
              field: '__field__',
              value: '__value__',
            }),
            new ConditionTreeLeaf({
              operator: Operator.Equal,
              field: '__field__',
              value: '__value__',
            }),
          ]);
          const filter = new Filter({
            conditionTree,
          });

          expect(() => FilterConverter.convertFilterToSequelize(filter)).toThrow(
            'Invalid (null) aggregator.',
          );
        });

        it('should fail when condition list is empty', () => {
          const conditionTree = new ConditionTreeBranch(Aggregator.And, []);
          const filter = new Filter({
            conditionTree,
          });

          expect(() => FilterConverter.convertFilterToSequelize(filter)).toThrow(
            'Two or more conditions needed for aggregation.',
          );
        });

        it('should fail when condition list has only one condition', () => {
          const conditionTree = new ConditionTreeBranch(Aggregator.And, [
            new ConditionTreeLeaf({
              operator: Operator.Blank,
              field: '__field__',
              value: '__value__',
            }),
          ]);
          const filter = new Filter({
            conditionTree,
          });

          expect(() => FilterConverter.convertFilterToSequelize(filter)).toThrow(
            'Two or more conditions needed for aggregation.',
          );
        });

        it.each([
          ['AND', Aggregator.And, Op.and],
          ['OR', Aggregator.Or, Op.or],
        ])(
          'should generate a "%s where" Sequelize filter from conditions',
          (message, aggregator, operator) => {
            const conditions = [
              new ConditionTreeLeaf({
                operator: Operator.Equal,
                field: '__field_1__',
                value: '__value_1__',
              }),
              new ConditionTreeLeaf({
                operator: Operator.Equal,
                field: '__field_2__',
                value: '__value_2__',
              }),
            ];
            const conditionTree = new ConditionTreeBranch(aggregator, conditions);
            const filter = new Filter({
              conditionTree,
            });

            expect(FilterConverter.convertFilterToSequelize(filter)).toEqual({
              where: {
                [operator]: [
                  {
                    [conditions[0].field]: { [Op.eq]: conditions[0].value },
                  },
                  {
                    [conditions[1].field]: { [Op.eq]: conditions[1].value },
                  },
                ],
              },
            });
          },
        );
      });

      describe('with a ConditionTreeLeaf node', () => {
        const defaultArrayValue = [21, 42, 84];
        const defaultIntegerValue = 42;

        it.each([
          ['Operator.Blank', undefined, { [Op.or]: [{ [Op.is]: null }, { [Op.eq]: '' }] }],
          ['Operator.Contains', '__value__', { [Op.iLike]: '%__value__%' }],
          ['Operator.EndsWith', '__value__', { [Op.iLike]: '%__value__' }],
          ['Operator.Equal', defaultIntegerValue, { [Op.eq]: defaultIntegerValue }],
          ['Operator.GreaterThan', defaultIntegerValue, { [Op.gt]: defaultIntegerValue }],
          ['Operator.In', defaultArrayValue, { [Op.in]: defaultArrayValue }],
          ['Operator.IncludesAll', defaultArrayValue, { [Op.contains]: defaultArrayValue }],
          ['Operator.LessThan', defaultIntegerValue, { [Op.lt]: defaultIntegerValue }],
          ['Operator.Missing', undefined, { [Op.is]: null }],
          ['Operator.NotContains', '__value__', { [Op.notILike]: '%__value__%' }],
          ['Operator.NotEqual', defaultIntegerValue, { [Op.ne]: defaultIntegerValue }],
          ['Operator.NotIn', defaultArrayValue, { [Op.notIn]: defaultArrayValue }],
          ['Operator.Present', undefined, { [Op.not]: { [Op.is]: null } }],
          ['Operator.StartsWith', '__value__', { [Op.iLike]: '__value__%' }],
        ])(
          'should generate a "where" Sequelize filter from a "%s" ConditionTreeLeaf',
          (operator, value, where) => {
            const conditionTree = new ConditionTreeLeaf({
              operator: Operator[operator.split('.')[1]],
              field: '__field__',
              value,
            });
            const filter = new Filter({
              conditionTree,
            });

            const sequelizeFilter = FilterConverter.convertFilterToSequelize(filter);

            expect(sequelizeFilter).toEqual(
              expect.objectContaining({
                where: expect.objectContaining({
                  __field__: where,
                }),
              }),
            );
          },
        );

        it('should fail with a null operator', () => {
          expect(() =>
            FilterConverter.convertFilterToSequelize(
              new Filter({
                conditionTree: new ConditionTreeLeaf({
                  operator: null,
                  field: '__field__',
                  value: '__value__',
                }),
              }),
            ),
          ).toThrow('Invalid (null) operator.');
        });

        it('should fail with an invalid operator', () => {
          expect(() =>
            FilterConverter.convertFilterToSequelize(
              new Filter({
                conditionTree: new ConditionTreeLeaf({
                  operator: '__invalid__' as Operator,
                  field: '__field__',
                  value: '__value__',
                }),
              }),
            ),
          ).toThrow('Unsupported operator: "__invalid__".');
        });
      });

      describe('with a ConditionTreeNot node', () => {
        it('should fail with an empty condition', () => {
          const filter = new Filter({
            conditionTree: new ConditionTreeNot(null),
          });

          expect(() => FilterConverter.convertFilterToSequelize(filter)).toThrow(
            'Invalid (null) condition.',
          );
        });

        it('should generate a "where" Sequelize filter from a ConditionTreeNot', () => {
          const condition = new ConditionTreeLeaf({
            operator: Operator.Equal,
            field: '__field__',
            value: '__value__',
          });
          const conditionTree = new ConditionTreeNot(condition);
          const filter = new Filter({
            conditionTree,
          });

          expect(FilterConverter.convertFilterToSequelize(filter)).toEqual({
            where: {
              [Op.not]: {
                [condition.field]: { [Op.eq]: condition.value },
              },
            },
          });
        });
      });
    });

    describe('with array operator', () => {
      const makeFilter = (operator, value) => {
        const conditionTree = new ConditionTreeLeaf({
          operator,
          field: '__field__',
          value,
        });
        const filter = new Filter({
          conditionTree,
        });

        return filter;
      };

      describe.each([
        ['In', Operator.In, Op.in],
        ['IncludesAll', Operator.IncludesAll, Op.contains],
        ['NotIn', Operator.NotIn, Op.notIn],
      ])('"%s"', (message, schemaOperator, sequelizeOperator) => {
        it('should handle atomic values', () => {
          const value = 42;
          const filter = makeFilter(schemaOperator, value);
          const sequelizeFilter = FilterConverter.convertFilterToSequelize(filter);

          expect(sequelizeFilter).toEqual(
            expect.objectContaining({
              where: { __field__: { [sequelizeOperator]: [value] } },
            }),
          );
        });

        it('should handle array values', () => {
          const value = [42];
          const filter = makeFilter(schemaOperator, value);
          const sequelizeFilter = FilterConverter.convertFilterToSequelize(filter);

          expect(sequelizeFilter).toEqual(
            expect.objectContaining({
              where: { __field__: { [sequelizeOperator]: value } },
            }),
          );
        });
      });
    });
  });

  describe('convertPaginatedFilterToSequelize', () => {
    it('should return with defaults when called with a classic Filter', () => {
      const defaultInputFilter = new PaginatedFilter({});
      const defaultPaginatedFilter = {};

      expect(FilterConverter.convertPaginatedFilterToSequelize(defaultInputFilter)).toEqual(
        defaultPaginatedFilter,
      );
    });

    describe('with paging', () => {
      it('should ignore "limit" when missing', () => {
        const noLimitFilter = new PaginatedFilter({
          page: new Page(42),
        });

        expect(FilterConverter.convertPaginatedFilterToSequelize(noLimitFilter)).toEqual({
          offset: noLimitFilter.page.skip,
        });
      });

      it('should ignore "skip" when missing', () => {
        const noSkipFilter = new PaginatedFilter({
          page: new Page(),
        });

        expect(FilterConverter.convertPaginatedFilterToSequelize(noSkipFilter)).toEqual(
          expect.objectContaining({
            offset: 0,
          }),
        );
      });

      it('should honor values from "page"', () => {
        const filter = new PaginatedFilter({
          page: new Page(42, 21),
        });

        expect(FilterConverter.convertPaginatedFilterToSequelize(filter)).toEqual(
          expect.objectContaining({
            limit: filter.page.limit,
            offset: filter.page.skip,
          }),
        );
      });
    });

    describe('with sorting', () => {
      it('should omit the "order" clause when condition list is empty', () => {
        const noOrderConditionFilter = new PaginatedFilter({
          sort: new Sort(),
        });

        expect(FilterConverter.convertPaginatedFilterToSequelize(noOrderConditionFilter)).toEqual(
          {},
        );
      });

      it('should honor values from "sort"', () => {
        const filter = new PaginatedFilter({
          sort: new Sort({ field: '__a__', ascending: true }, { field: '__b__', ascending: false }),
        });

        expect(FilterConverter.convertPaginatedFilterToSequelize(filter)).toEqual({
          order: [
            ['__a__', 'ASC'],
            ['__b__', 'DESC'],
          ],
        });
      });
    });
  });
});
