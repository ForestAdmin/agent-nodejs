/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Aggregator,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Operator,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';
import { Association, ModelDefined, Op } from 'sequelize';

import QueryConverter from '../../src/utils/query-converter';

describe('Utils > QueryConverter', () => {
  describe('getWhereFromConditionTree', () => {
    it('should fail with an invalid conditionTree', () => {
      const conditionTree = {
        operator: undefined,
      } as unknown as ConditionTreeBranch;

      expect(() =>
        QueryConverter.getWhereFromConditionTree({} as ModelDefined<any, any>, conditionTree),
      ).toThrow('Invalid ConditionTree.');
    });

    describe('with a condition tree', () => {
      describe('when a null condition tree is given', () => {
        it('should return an empty object', () => {
          expect(
            QueryConverter.getWhereFromConditionTree({} as ModelDefined<any, any>, null),
          ).toEqual({});
        });
      });

      describe('with a ConditionTreeBranch node', () => {
        it('should fail when aggregator is empty', () => {
          const conditionTree = new ConditionTreeBranch(null, [
            new ConditionTreeLeaf('__field__', 'Equal', '__value__'),
            new ConditionTreeLeaf('__field__', 'Equal', '__value__'),
          ]);

          expect(() =>
            QueryConverter.getWhereFromConditionTree({} as ModelDefined<any, any>, conditionTree),
          ).toThrow('Invalid (null) aggregator.');
        });

        it('should throw an error when conditions is not an array', () => {
          const conditionTree = new ConditionTreeBranch('And', null);

          expect(() =>
            QueryConverter.getWhereFromConditionTree({} as ModelDefined<any, any>, conditionTree),
          ).toThrow('Conditions must be an array.');
        });

        it('should not throw an error when there is no condition', () => {
          const conditionTree = new ConditionTreeBranch('And', []);

          expect(() =>
            QueryConverter.getWhereFromConditionTree({} as ModelDefined<any, any>, conditionTree),
          ).not.toThrow();
        });

        describe('with only one condition', () => {
          it('should not throw an error with the And aggregator', () => {
            const conditionTree = new ConditionTreeBranch('And', [
              new ConditionTreeLeaf('__field_1__', 'Equal', '__value_1__'),
            ]);
            const model = {
              getAttributes: () => ({ __field_1__: { field: '__field_1__' } }),
            } as unknown as ModelDefined<any, any>;

            expect(() =>
              QueryConverter.getWhereFromConditionTree(model, conditionTree),
            ).not.toThrow();
          });

          it('should not throw an error with the Or aggregator', () => {
            const conditionTree = new ConditionTreeBranch('Or', [
              new ConditionTreeLeaf('__field_1__', 'Equal', '__value_1__'),
            ]);
            const model = {
              getAttributes: () => ({ __field_1__: { field: '__field_1__' } }),
            } as unknown as ModelDefined<any, any>;

            expect(() =>
              QueryConverter.getWhereFromConditionTree(model, conditionTree),
            ).not.toThrow();
          });
        });

        it.each([
          ['AND', 'And', Op.and],
          ['OR', 'Or', Op.or],
        ])(
          'should generate a "%s where" Sequelize filter from conditions',
          (message, aggregator, operator) => {
            const conditions = [
              new ConditionTreeLeaf('__field_1__', 'Equal', '__value_1__'),
              new ConditionTreeLeaf('__field_2__', 'Equal', '__value_2__'),
            ];
            const conditionTree = new ConditionTreeBranch(aggregator as Aggregator, conditions);
            const model = {
              getAttributes: () => ({
                __field_1__: { field: '__field_1__' },
                __field_2__: { field: '__field_2__' },
              }),
            } as unknown as ModelDefined<any, any>;

            expect(QueryConverter.getWhereFromConditionTree(model, conditionTree)).toEqual({
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
          ['Blank', undefined, { [Op.or]: [{ [Op.is]: null }, { [Op.eq]: '' }] }],
          ['Equal', defaultIntegerValue, { [Op.eq]: defaultIntegerValue }],
          ['GreaterThan', defaultIntegerValue, { [Op.gt]: defaultIntegerValue }],
          ['In', defaultArrayValue, { [Op.in]: defaultArrayValue }],
          ['IncludesAll', defaultArrayValue, { [Op.contains]: defaultArrayValue }],
          ['LessThan', defaultIntegerValue, { [Op.lt]: defaultIntegerValue }],
          ['Missing', undefined, { [Op.is]: null }],
          ['NotEqual', defaultIntegerValue, { [Op.ne]: defaultIntegerValue }],
          ['NotIn', defaultArrayValue, { [Op.notIn]: defaultArrayValue }],
          ['Present', undefined, { [Op.ne]: null }],
        ])(
          'should generate a "where" Sequelize filter from a "%s" operator',
          (operator, value, where) => {
            const conditionTree = new ConditionTreeLeaf('__field__', operator as Operator, value);
            const model = {
              getAttributes: () => ({ __field__: { field: '__field__' } }),
            } as unknown as ModelDefined<any, any>;

            const sequelizeFilter = QueryConverter.getWhereFromConditionTree(model, conditionTree);

            expect(sequelizeFilter).toEqual(
              expect.objectContaining({
                __field__: where,
              }),
            );
          },
        );

        describe('using operator translate to SQL "LIKE" clause', () => {
          it.each([
            ['StartsWith', '__Value__', 'LIKE', '__value__%'],
            ['EndsWith', '__vAlue__', 'LIKE', '%__value__'],
            ['Contains', '__vaLue__', 'LIKE', '%__value__%'],
            ['NotContains', '__valUe__', 'NOT LIKE', '%__value__%'],
          ])(
            'should generate a "where" Sequelize filter from a "%s" operator',
            (operator, value, sqlClause, like) => {
              const conditionTree = new ConditionTreeLeaf('__field__', operator as Operator, value);
              const model = {
                getAttributes: () => ({ __field__: { field: '__field__' } }),
              } as unknown as ModelDefined<any, any>;

              const sequelizeFilter = QueryConverter.getWhereFromConditionTree(
                model,
                conditionTree,
              );

              expect(sequelizeFilter).toEqual(
                expect.objectContaining({
                  __field__: {
                    attribute: {
                      fn: 'LOWER',
                      args: [{ col: '__field__' }],
                    },
                    comparator: sqlClause,
                    logic: like,
                  },
                }),
              );
            },
          );
        });

        it('should fail with a null operator', () => {
          const model = {
            getAttributes: () => ({ __field__: { field: '__field__' } }),
          } as unknown as ModelDefined<any, any>;

          expect(() =>
            QueryConverter.getWhereFromConditionTree(
              model,
              new ConditionTreeLeaf('__field__', null, '__value__'),
            ),
          ).toThrow('Invalid (null) operator.');
        });

        it('should fail with an invalid operator', () => {
          const model = {
            getAttributes: () => ({ __field__: { field: '__field__' } }),
          } as unknown as ModelDefined<any, any>;

          expect(() =>
            QueryConverter.getWhereFromConditionTree(
              model,
              new ConditionTreeLeaf('__field__', '__invalid__' as Operator, '__value__'),
            ),
          ).toThrow('Unsupported operator: "__invalid__".');
        });
      });

      describe('with a renamed field', () => {
        it('should generate a valid where clause', () => {
          const conditionTree = new ConditionTreeLeaf('__field__', 'Equal', '__value__');

          const model = {
            getAttributes: () => ({ __field__: { field: 'fieldName' } }),
          } as unknown as ModelDefined<any, any>;

          expect(QueryConverter.getWhereFromConditionTree(model, conditionTree)).toEqual({
            fieldName: { [Op.eq]: '__value__' },
          });
        });
      });

      describe('with a condition tree acting on relation', () => {
        it('should generate a valid where clause', () => {
          const conditionTree = new ConditionTreeLeaf('relation:__field__', 'Equal', '__value__');

          const model = {
            associations: {
              relation: {
                target: {
                  getAttributes: () => ({ __field__: { field: 'fieldName' } }),
                } as unknown as ModelDefined<any, any>,
              } as Association,
            },
          } as unknown as ModelDefined<any, any>;

          expect(QueryConverter.getWhereFromConditionTree(model, conditionTree)).toEqual({
            '$relation.fieldName$': { [Op.eq]: '__value__' },
          });
        });

        describe('with deep relation', () => {
          it('should generate a valid where clause', () => {
            const conditionTree = new ConditionTreeLeaf(
              'relation:relationB:__field__',
              'Equal',
              '__value__',
            );

            const model = {
              associations: {
                relation: {
                  target: {
                    associations: {
                      relationB: {
                        target: {
                          getAttributes: () => ({ __field__: { field: 'fieldName' } }),
                        },
                      },
                    },
                  } as unknown as ModelDefined<any, any>,
                } as Association,
              },
            } as unknown as ModelDefined<any, any>;

            expect(QueryConverter.getWhereFromConditionTree(model, conditionTree)).toEqual({
              '$relation.relationB.fieldName$': { [Op.eq]: '__value__' },
            });
          });
        });
      });
    });

    describe('with array operator', () => {
      describe.each([
        ['In', 'In', Op.in],
        ['IncludesAll', 'IncludesAll', Op.contains],
        ['NotIn', 'NotIn', Op.notIn],
      ])('"%s"', (message, operator, sequelizeOperator) => {
        it('should handle atomic values', () => {
          const model = {
            getAttributes: () => ({ __field__: { field: '__field__' } }),
          } as unknown as ModelDefined<any, any>;
          const sequelizeFilter = QueryConverter.getWhereFromConditionTree(
            model,
            new ConditionTreeLeaf('__field__', operator as Operator, 42),
          );

          expect(sequelizeFilter).toEqual(
            expect.objectContaining({ __field__: { [sequelizeOperator]: [42] } }),
          );
        });

        it('should handle array values', () => {
          const model = {
            getAttributes: () => ({ __field__: { field: '__field__' } }),
          } as unknown as ModelDefined<any, any>;
          const sequelizeFilter = QueryConverter.getWhereFromConditionTree(
            model,
            new ConditionTreeLeaf('__field__', operator as Operator, [42]),
          );

          expect(sequelizeFilter).toEqual(
            expect.objectContaining({ __field__: { [sequelizeOperator]: [42] } }),
          );
        });
      });
    });
  });

  describe('getOrderFromSort', () => {
    it('should omit the "order" clause when condition list is empty', () => {
      expect(QueryConverter.getOrderFromSort(new Sort())).toEqual([]);
    });

    it('should honor values from "sort"', () => {
      const sort = new Sort(
        { field: '__a__', ascending: true },
        { field: '__b__', ascending: false },
      );

      expect(QueryConverter.getOrderFromSort(sort)).toEqual([
        ['__a__', 'ASC'],
        ['__b__', 'DESC'],
      ]);
    });
  });

  describe('getIncludeWithAttributesFromProjection', () => {
    describe('when projection have relation field', () => {
      it('should add include with attributes', () => {
        const projection = new Projection('model:another_field');

        expect(QueryConverter.getIncludeWithAttributesFromProjection(projection)).toEqual([
          { association: 'model', include: [], attributes: ['another_field'] },
        ]);
      });

      it('should add include recursively with attributes', () => {
        const projection = new Projection('model:another_model:a_field');
        expect(QueryConverter.getIncludeWithAttributesFromProjection(projection)).toEqual([
          {
            association: 'model',
            include: [{ association: 'another_model', include: [], attributes: ['a_field'] }],
            attributes: [],
          },
        ]);
      });
    });
  });

  describe('getIncludeFromProjection', () => {
    describe('when projection have relation field', () => {
      it('should add include', () => {
        const projection = new Projection('model:another_field');

        expect(QueryConverter.getIncludeFromProjection(projection)).toEqual([
          { association: 'model', include: [], attributes: [] },
        ]);
      });

      it('should add include recursively', () => {
        const projection = new Projection('model:another_model:a_field');
        expect(QueryConverter.getIncludeFromProjection(projection)).toEqual([
          {
            association: 'model',
            include: [{ association: 'another_model', include: [], attributes: [] }],
            attributes: [],
          },
        ]);
      });
    });
  });
});
