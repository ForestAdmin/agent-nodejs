import {
  Aggregator,
  ConditionTree,
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
import { ModelDefined, Op } from 'sequelize';

import QueryConverter from '../../src/utils/query-converter';

describe.only('Utils > QueryConverter', () => {
  describe('getWhereFromConditionTree', () => {
    it('should fail with an invalid conditionTree', () => {
      const conditionTree = {
        operator: undefined,
      } as unknown as ConditionTreeBranch;

      expect(() =>
        QueryConverter.getWhereFromConditionTree(conditionTree, {} as ModelDefined<any, any>),
      ).toThrow('Invalid ConditionTree.');
    });

    describe('with a condition tree', () => {
      describe('with a ConditionTreeBranch node', () => {
        it('should fail when aggregator is empty', () => {
          const conditionTree = new ConditionTreeBranch(null, [
            new ConditionTreeLeaf('__field__', Operator.Equal, '__value__'),
            new ConditionTreeLeaf('__field__', Operator.Equal, '__value__'),
          ]);

          expect(() =>
            QueryConverter.getWhereFromConditionTree(conditionTree, {} as ModelDefined<any, any>),
          ).toThrow('Invalid (null) aggregator.');
        });

        it('should fail when condition list is empty', () => {
          const conditionTree = new ConditionTreeBranch(Aggregator.And, []);

          expect(() =>
            QueryConverter.getWhereFromConditionTree(conditionTree, {} as ModelDefined<any, any>),
          ).toThrow('Two or more conditions needed for aggregation.');
        });

        it('should fail when condition list has only one condition', () => {
          const conditionTree = new ConditionTreeBranch(Aggregator.And, [
            new ConditionTreeLeaf('__field__', Operator.Blank),
          ]);

          expect(() =>
            QueryConverter.getWhereFromConditionTree(conditionTree, {} as ModelDefined<any, any>),
          ).toThrow('Two or more conditions needed for aggregation.');
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

            expect(
              QueryConverter.getWhereFromConditionTree(conditionTree, {} as ModelDefined<any, any>),
            ).toEqual({
              [operator]: [
                {
                  [conditions[0].field]: { [Op.eq]: conditions[0].value },
                },
                {
                  [conditions[1].field]: { [Op.eq]: conditions[1].value },
                },
              ],
            });
          },
        );
      });

      describe('with a ConditionTreeLeaf node', () => {
        const defaultArrayValue = [21, 42, 84];
        const defaultIntegerValue = 42;

        it.each([
          ['Operator.Blank', undefined, { [Op.or]: [{ [Op.is]: null }, { [Op.eq]: '' }] }],
          ['Operator.Contains', '__value__', { [Op.like]: '%__value__%' }],
          ['Operator.EndsWith', '__value__', { [Op.like]: '%__value__' }],
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
          ['Operator.StartsWith', '__value__', { [Op.like]: '__value__%' }],
        ])(
          'should generate a "where" Sequelize filter from a "%s" ConditionTreeLeaf',
          (operator, value, where) => {
            const conditionTree = new ConditionTreeLeaf(
              '__field__',
              Operator[operator.split('.')[1]],
              value,
            );

            const sequelizeFilter = QueryConverter.getWhereFromConditionTree(
              conditionTree,
              {} as ModelDefined<any, any>,
            );

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
            QueryConverter.getWhereFromConditionTree(
              new ConditionTreeLeaf('__field__', null, '__value__'),
              {} as ModelDefined<any, any>,
            ),
          ).toThrow('Invalid (null) operator.');
        });

        it('should fail with an invalid operator', () => {
          expect(() =>
            QueryConverter.getWhereFromConditionTree(
              new ConditionTreeLeaf('__field__', '__invalid__' as Operator, '__value__'),
              {} as ModelDefined<any, any>,
            ),
          ).toThrow('Unsupported operator: "__invalid__".');
        });
      });

      describe('with a ConditionTreeNot node', () => {
        it('should fail with an empty condition', () => {
          expect(() =>
            QueryConverter.getWhereFromConditionTree(
              new ConditionTreeNot(null),
              {} as ModelDefined<any, any>,
            ),
          ).toThrow('Invalid (null) condition.');
        });

        it('should generate a "where" Sequelize filter from a ConditionTreeNot', () => {
          const condition = new ConditionTreeLeaf('__field__', Operator.Equal, '__value__');
          const conditionTree = new ConditionTreeNot(condition);

          expect(
            QueryConverter.getWhereFromConditionTree(conditionTree, {} as ModelDefined<any, any>),
          ).toEqual({
            [Op.not]: {
              [condition.field]: { [Op.eq]: condition.value },
            },
          });
        });
      });
    });

    describe('with array operator', () => {
      describe.each([
        ['In', Operator.In, Op.in],
        ['IncludesAll', Operator.IncludesAll, Op.contains],
        ['NotIn', Operator.NotIn, Op.notIn],
      ])('"%s"', (message, schemaOperator, sequelizeOperator) => {
        it('should handle atomic values', () => {
          const sequelizeFilter = QueryConverter.getWhereFromConditionTree(
            new ConditionTreeLeaf('__field__', schemaOperator, 42),
            {} as ModelDefined<any, any>,
          );

          expect(sequelizeFilter).toEqual(
            expect.objectContaining({ __field__: { [sequelizeOperator]: [42] } }),
          );
        });

        it('should handle array values', () => {
          const sequelizeFilter = QueryConverter.getWhereFromConditionTree(
            new ConditionTreeLeaf('__field__', schemaOperator, [42]),
            {} as ModelDefined<any, any>,
          );

          expect(sequelizeFilter).toEqual(
            expect.objectContaining({ __field__: { [sequelizeOperator]: 42 } }),
          );
        });
      });
    });
  });

  // describe('convertPaginatedFilterToSequelize', () => {
  //   it('should return with defaults when called with a classic Filter', () => {
  //     const defaultInputFilter = new PaginatedFilter({});
  //     const defaultPaginatedFilter = {};

  //     expect(
  //       QueryConverter.convertPaginatedFilterToSequelize(
  //         {} as ModelDefined<any, any>,
  //         defaultInputFilter,
  //       ),
  //     ).toEqual(defaultPaginatedFilter);
  //   });

  //   describe('with paging', () => {
  //     it('should ignore "limit" when missing', () => {
  //       const noLimitFilter = new PaginatedFilter({
  //         page: new Page(42),
  //       });

  //       expect(
  //         QueryConverter.convertPaginatedFilterToSequelize(
  //           {} as ModelDefined<any, any>,
  //           noLimitFilter,
  //         ),
  //       ).toEqual({
  //         offset: noLimitFilter.page.skip,
  //       });
  //     });

  //     it('should ignore "skip" when missing', () => {
  //       const noSkipFilter = new PaginatedFilter({
  //         page: new Page(),
  //       });

  //       expect(
  //         QueryConverter.convertPaginatedFilterToSequelize(
  //           {} as ModelDefined<any, any>,
  //           noSkipFilter,
  //         ),
  //       ).toEqual(
  //         expect.objectContaining({
  //           offset: 0,
  //         }),
  //       );
  //     });

  //     it('should honor values from "page"', () => {
  //       const filter = new PaginatedFilter({
  //         page: new Page(42, 21),
  //       });

  //       expect(
  //         QueryConverter.convertPaginatedFilterToSequelize({} as ModelDefined<any, any>, filter),
  //       ).toEqual(
  //         expect.objectContaining({
  //           limit: filter.page.limit,
  //           offset: filter.page.skip,
  //         }),
  //       );
  //     });
  //   });

  //   describe('with sorting', () => {
  //     it('should omit the "order" clause when condition list is empty', () => {
  //       const noOrderConditionFilter = new PaginatedFilter({
  //         sort: new Sort(),
  //       });

  //       expect(
  //         QueryConverter.convertPaginatedFilterToSequelize(
  //           {} as ModelDefined<any, any>,
  //           noOrderConditionFilter,
  //         ),
  //       ).toEqual({});
  //     });

  //     it('should honor values from "sort"', () => {
  //       const filter = new PaginatedFilter({
  //         sort: new Sort({ field: '__a__', ascending: true }, { field: '__b__', ascending: false }),
  //       });

  //       expect(
  //         QueryConverter.convertPaginatedFilterToSequelize({} as ModelDefined<any, any>, filter),
  //       ).toEqual({
  //         order: [
  //           ['__a__', 'ASC'],
  //           ['__b__', 'DESC'],
  //         ],
  //       });
  //     });
  //   });
  // });

  // describe('convertProjectionToSequelize', () => {
  //   describe('when no project is given', () => {
  //     it('should return empty object', () => {
  //       expect(QueryConverter.convertProjectionToSequelize(null)).toStrictEqual({});
  //     });
  //   });

  //   it('should return attributes', () => {
  //     const projection = new Projection('field');
  //     expect(QueryConverter.convertProjectionToSequelize(projection)).toEqual(
  //       expect.objectContaining({
  //         attributes: ['field'],
  //       }),
  //     );
  //   });

  //   describe('when projection have relation field', () => {
  //     it('should add include', () => {
  //       const projection = new Projection('model:another_field');
  //       expect(QueryConverter.convertProjectionToSequelize(projection)).toEqual(
  //         expect.objectContaining({
  //           include: [{ association: 'model', attributes: ['another_field'], include: [] }],
  //         }),
  //       );
  //     });

  //     it('should add include recursively', () => {
  //       const projection = new Projection('model:another_model:a_field');
  //       expect(QueryConverter.convertProjectionToSequelize(projection)).toEqual(
  //         expect.objectContaining({
  //           include: [
  //             {
  //               association: 'model',
  //               attributes: [],
  //               include: [{ association: 'another_model', attributes: ['a_field'], include: [] }],
  //             },
  //           ],
  //         }),
  //       );
  //     });

  //     describe('when withAttributes option was false', () => {
  //       it('should not add include attributes', () => {
  //         const projection = new Projection('model:another_field');
  //         expect(QueryConverter.convertProjectionToSequelize(projection, false)).toEqual(
  //           expect.objectContaining({
  //             include: [{ association: 'model', attributes: [], include: [] }],
  //           }),
  //         );
  //       });
  //     });
  //   });
  // });
});
