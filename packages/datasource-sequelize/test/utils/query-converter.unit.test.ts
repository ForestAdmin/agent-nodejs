import {
  Aggregator,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  ConditionTreeNot,
  Filter,
  Operator,
  Page,
  PaginatedFilter,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';
import { Op } from 'sequelize';

import QueryConverter from '../../src/utils/query-converter';

describe('Utils > QueryConverter', () => {
  describe('convertFilterToSequelize', () => {
    it('should fail with a null filter', () => {
      expect(() => QueryConverter.convertFilterToSequelize(null)).toThrow('Invalid (null) filter.');
    });

    it.each([
      ['a missing', new Filter({})],
      ['a null', new Filter({ conditionTree: null })],
      ['an undefined', new Filter({ conditionTree: undefined })],
    ])('should omit the "where" Sequelize clause with %s conditionTree', (message, filter) => {
      const sequelizeFilter = QueryConverter.convertFilterToSequelize(filter);

      expect(sequelizeFilter).not.toContain({ where: expect.anything() });
    });

    it('should fail with an invalid conditionTree', () => {
      const filter = new Filter({
        conditionTree: {
          operator: undefined,
        } as unknown as ConditionTreeBranch,
      });

      expect(() => QueryConverter.convertFilterToSequelize(filter)).toThrow(
        'Invalid ConditionTree.',
      );
    });

    describe('with a condition tree', () => {
      describe('with a ConditionTreeBranch node', () => {
        it('should fail when aggregator is empty', () => {
          const conditionTree = new ConditionTreeBranch(null, [
            new ConditionTreeLeaf('__field__', Operator.Equal, '__value__'),
            new ConditionTreeLeaf('__field__', Operator.Equal, '__value__'),
          ]);
          const filter = new Filter({
            conditionTree,
          });

          expect(() => QueryConverter.convertFilterToSequelize(filter)).toThrow(
            'Invalid (null) aggregator.',
          );
        });

        it('should fail when condition list is empty', () => {
          const conditionTree = new ConditionTreeBranch(Aggregator.And, []);
          const filter = new Filter({
            conditionTree,
          });

          expect(() => QueryConverter.convertFilterToSequelize(filter)).toThrow(
            'Two or more conditions needed for aggregation.',
          );
        });

        it('should fail when condition list has only one condition', () => {
          const conditionTree = new ConditionTreeBranch(Aggregator.And, [
            new ConditionTreeLeaf('__field__', Operator.Blank),
          ]);
          const filter = new Filter({
            conditionTree,
          });

          expect(() => QueryConverter.convertFilterToSequelize(filter)).toThrow(
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
              new ConditionTreeLeaf('__field_1__', Operator.Equal, '__value_1__'),
              new ConditionTreeLeaf('__field_2__', Operator.Equal, '__value_2__'),
            ];
            const conditionTree = new ConditionTreeBranch(aggregator, conditions);
            const filter = new Filter({
              conditionTree,
            });

            expect(QueryConverter.convertFilterToSequelize(filter)).toEqual({
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
            const conditionTree = new ConditionTreeLeaf(
              '__field__',
              Operator[operator.split('.')[1]],
              value,
            );
            const filter = new Filter({
              conditionTree,
            });

            const sequelizeFilter = QueryConverter.convertFilterToSequelize(filter);

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
            QueryConverter.convertFilterToSequelize(
              new Filter({
                conditionTree: new ConditionTreeLeaf('__field__', null, '__value__'),
              }),
            ),
          ).toThrow('Invalid (null) operator.');
        });

        it('should fail with an invalid operator', () => {
          expect(() =>
            QueryConverter.convertFilterToSequelize(
              new Filter({
                conditionTree: new ConditionTreeLeaf(
                  '__field__',
                  '__invalid__' as Operator,
                  '__value__',
                ),
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

          expect(() => QueryConverter.convertFilterToSequelize(filter)).toThrow(
            'Invalid (null) condition.',
          );
        });

        it('should generate a "where" Sequelize filter from a ConditionTreeNot', () => {
          const condition = new ConditionTreeLeaf('__field__', Operator.Equal, '__value__');
          const conditionTree = new ConditionTreeNot(condition);
          const filter = new Filter({ conditionTree });

          expect(QueryConverter.convertFilterToSequelize(filter)).toEqual({
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
        const conditionTree = new ConditionTreeLeaf('__field__', operator, value);
        const filter = new Filter({ conditionTree });

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
          const sequelizeFilter = QueryConverter.convertFilterToSequelize(filter);

          expect(sequelizeFilter).toEqual(
            expect.objectContaining({
              where: { __field__: { [sequelizeOperator]: [value] } },
            }),
          );
        });

        it('should handle array values', () => {
          const value = [42];
          const filter = makeFilter(schemaOperator, value);
          const sequelizeFilter = QueryConverter.convertFilterToSequelize(filter);

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

      expect(QueryConverter.convertPaginatedFilterToSequelize(defaultInputFilter)).toEqual(
        defaultPaginatedFilter,
      );
    });

    describe('with paging', () => {
      it('should ignore "limit" when missing', () => {
        const noLimitFilter = new PaginatedFilter({
          page: new Page(42),
        });

        expect(QueryConverter.convertPaginatedFilterToSequelize(noLimitFilter)).toEqual({
          offset: noLimitFilter.page.skip,
        });
      });

      it('should ignore "skip" when missing', () => {
        const noSkipFilter = new PaginatedFilter({
          page: new Page(),
        });

        expect(QueryConverter.convertPaginatedFilterToSequelize(noSkipFilter)).toEqual(
          expect.objectContaining({
            offset: 0,
          }),
        );
      });

      it('should honor values from "page"', () => {
        const filter = new PaginatedFilter({
          page: new Page(42, 21),
        });

        expect(QueryConverter.convertPaginatedFilterToSequelize(filter)).toEqual(
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

        expect(QueryConverter.convertPaginatedFilterToSequelize(noOrderConditionFilter)).toEqual(
          {},
        );
      });

      it('should honor values from "sort"', () => {
        const filter = new PaginatedFilter({
          sort: new Sort({ field: '__a__', ascending: true }, { field: '__b__', ascending: false }),
        });

        expect(QueryConverter.convertPaginatedFilterToSequelize(filter)).toEqual({
          order: [
            ['__a__', 'ASC'],
            ['__b__', 'DESC'],
          ],
        });
      });
    });
  });

  describe('convertProjectionToSequelize', () => {
    describe('when no project is given', () => {
      it('should return empty object', () => {
        expect(QueryConverter.convertProjectionToSequelize(null)).toStrictEqual({});
      });
    });

    it('should return attributes', () => {
      const projection = new Projection('field');
      expect(QueryConverter.convertProjectionToSequelize(projection)).toEqual(
        expect.objectContaining({
          attributes: ['field'],
        }),
      );
    });

    describe('when projection have relation field', () => {
      it('should add include', () => {
        const projection = new Projection('model:another_field');
        expect(QueryConverter.convertProjectionToSequelize(projection)).toEqual(
          expect.objectContaining({
            include: [{ association: 'model', attributes: ['another_field'], include: [] }],
          }),
        );
      });

      it('should add include recursively', () => {
        const projection = new Projection('model:another_model:a_field');
        expect(QueryConverter.convertProjectionToSequelize(projection)).toEqual(
          expect.objectContaining({
            include: [
              {
                association: 'model',
                attributes: [],
                include: [{ association: 'another_model', attributes: ['a_field'], include: [] }],
              },
            ],
          }),
        );
      });

      describe('when withAttributes option was false', () => {
        it('should not add include attributes', () => {
          const projection = new Projection('model:another_field');
          expect(QueryConverter.convertProjectionToSequelize(projection, false)).toEqual(
            expect.objectContaining({
              include: [{ association: 'model', attributes: [], include: [] }],
            }),
          );
        });
      });
    });
  });
});
