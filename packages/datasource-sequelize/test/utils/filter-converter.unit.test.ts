import { Op } from 'sequelize';

import {
  Aggregator,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  ConditionTreeNot,
  Filter,
  Operator,
} from '@forestadmin/datasource-toolkit';

import {
  convertFilterToSequelize,
  convertPaginatedFilterToSequelize,
} from '../../src/utils/filter-converter';

describe('Utils > FilterConverter', () => {
  describe('convertFilterToSequelize', () => {
    it('should fail with a null filter', () => {
      expect(() => convertFilterToSequelize(null)).toThrow('Invalid (null) filter.');
    });

    it.each([
      ['a missing', {}],
      ['a null', { conditionTree: null }],
      ['an undefined', { conditionTree: undefined }],
    ])('should omit the "where" Sequelize clause with %s conditionTree', (message, filter) => {
      const sequelizeFilter = convertFilterToSequelize(filter);

      expect(sequelizeFilter).not.toContain({ where: expect.anything() });
    });

    it('should fail with an invalid conditionTree', () => {
      const filter: Filter = {
        conditionTree: {
          operator: undefined,
        } as unknown as ConditionTreeBranch,
      };

      expect(() => convertFilterToSequelize(filter)).toThrow('Invalid ConditionTree.');
    });

    describe('with a condition tree', () => {
      describe('with a ConditionTreeBranch node', () => {
        it('should fail when aggregator is empty', () => {
          const conditionTree: ConditionTreeBranch = {
            aggregator: null,
            conditions: [
              { operator: Operator.Equal, field: '__field__', value: '__value__' },
              { operator: Operator.Equal, field: '__field__', value: '__value__' },
            ],
          };
          const filter: Filter = {
            conditionTree,
          };

          expect(() => convertFilterToSequelize(filter)).toThrow('Invalid (null) aggregator.');
        });

        it('should fail when condition list is empty', () => {
          const conditionTree: ConditionTreeBranch = {
            aggregator: Aggregator.And,
            conditions: [],
          };
          const filter: Filter = {
            conditionTree,
          };

          expect(() => convertFilterToSequelize(filter)).toThrow(
            'Two or more conditions needed for aggregation.',
          );
        });

        it('should fail when condition list has only one condition', () => {
          const conditionTree: ConditionTreeBranch = {
            aggregator: Aggregator.And,
            conditions: [
              {
                operator: Operator.Blank,
                field: '__field__',
                value: '__value__',
              },
            ],
          };
          const filter: Filter = {
            conditionTree,
          };

          expect(() => convertFilterToSequelize(filter)).toThrow(
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
              {
                operator: Operator.Equal,
                field: '__field__',
                value: '__value__',
              },
              {
                operator: Operator.Equal,
                field: '__field__',
                value: '__value__',
              },
            ];
            const conditionTree: ConditionTreeBranch = {
              aggregator,
              conditions,
            };
            const filter: Filter = {
              conditionTree,
            };

            expect(convertFilterToSequelize(filter)).toEqual({
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
            const conditionTree: ConditionTreeLeaf = {
              operator: Operator[operator.split('.')[1]],
              field: '__field__',
              value,
            };
            const filter: Filter = {
              conditionTree,
            };

            const sequelizeFilter = convertFilterToSequelize(filter);

            expect(sequelizeFilter).toEqual(
              expect.objectContaining({
                where: expect.objectContaining({
                  __field__: expect.anything(),
                }),
              }),
            );

            const { __field__: fieldClause } = sequelizeFilter.where;

            expect(fieldClause).toEqual(where);
          },
        );

        it('should fail with a null operator', () => {
          expect(() =>
            convertFilterToSequelize({
              conditionTree: { operator: null, field: '__field__', value: '__value__' },
            }),
          ).toThrow('Invalid (null) operator.');
        });

        it('should fail with an invalid operator', () => {
          expect(() =>
            convertFilterToSequelize({
              conditionTree: {
                operator: '__invalid__' as Operator,
                field: '__field__',
                value: '__value__',
              },
            }),
          ).toThrow('Unsupported operator: "__invalid__".');
        });
      });

      describe('with a ConditionTreeNot node', () => {
        it('should fail with an empty condition', () => {
          const filter: Filter = {
            conditionTree: { condition: null },
          };
          expect(() => convertFilterToSequelize(filter)).toThrow('Invalid (null) condition.');
        });

        it('should generate a "where" Sequelize filter from a ConditionTreeNot', () => {
          const condition = {
            operator: Operator.Equal,
            field: '__field__',
            value: '__value__',
          };
          const conditionTree: ConditionTreeNot = {
            condition,
          };
          const filter: Filter = {
            conditionTree,
          };

          expect(convertFilterToSequelize(filter)).toEqual({
            where: {
              [Op.not]: {
                [condition.field]: { [Op.eq]: condition.value },
              },
            },
          });
        });
      });
    });
  });

  describe('convertPaginatedFilterToSequelize', () => {
    const defaultLimit = 10;
    const defaultOffset = 0;

    it('should return with defaults when called with a classic Filter', () => {
      const defaultInputFilter = {};
      const defaultPaginatedFilter = { limit: defaultLimit, offset: defaultOffset };

      expect(convertPaginatedFilterToSequelize(defaultInputFilter)).toEqual(defaultPaginatedFilter);
    });

    describe('with paging', () => {
      it('should ignore "limit" when missing', () => {
        const noLimitFilter = {
          page: {
            skip: 42,
          },
        };

        expect(convertPaginatedFilterToSequelize(noLimitFilter)).toEqual({
          limit: defaultLimit,
          offset: noLimitFilter.page.skip,
        });
      });

      it('should ignore "skip" when missing', () => {
        const noSkipFilter = {
          page: {
            limit: 42,
          },
        };

        expect(convertPaginatedFilterToSequelize(noSkipFilter)).toEqual(
          expect.objectContaining({
            limit: noSkipFilter.page.limit,
            offset: defaultOffset,
          }),
        );
      });

      it('should honor values from "page"', () => {
        const filter = {
          page: {
            limit: 21,
            skip: 42,
          },
        };

        expect(convertPaginatedFilterToSequelize(filter)).toEqual(
          expect.objectContaining({
            limit: filter.page.limit,
            offset: filter.page.skip,
          }),
        );
      });
    });

    describe('with sorting', () => {
      it('should omit the "order" clause when condition list is empty', () => {
        const noOrderConditionFilter = {
          sort: [],
        };

        expect(convertPaginatedFilterToSequelize(noOrderConditionFilter)).toEqual({
          limit: defaultLimit,
          offset: defaultOffset,
        });
      });

      it('should honor values from "sort"', () => {
        const filter = {
          sort: [
            { field: '__a__', ascending: true },
            { field: '__b__', ascending: false },
          ],
        };

        expect(convertPaginatedFilterToSequelize(filter)).toEqual({
          limit: defaultLimit,
          offset: defaultOffset,
          order: [
            ['__a__', 'ASC'],
            ['__b__', 'DESC'],
          ],
        });
      });
    });
  });
});
