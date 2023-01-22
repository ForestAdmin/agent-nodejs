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
  // const setupModel = (dialect: Dialect = 'postgres') => {
  //   const sequelize = new Sequelize({ dialect });
  //   const model = sequelize.define('model', {
  //     __field_1__: {
  //       type: DataTypes.STRING,
  //     },
  //     __field_2__: {
  //       type: DataTypes.STRING,
  //     },
  //     __renamed_field__: {
  //       type: DataTypes.STRING,
  //       field: 'fieldRenamed',
  //     },
  //   });

  //   return model;
  // };

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
          ['Equal', null, { terms: { __field_1__: [null] } }],
          ['LessThan', integerValue, { range: { __field_1__: { lt: integerValue } } }],
          ['GreaterThan', integerValue, { range: { __field_1__: { gt: integerValue } } }],
          ['In', [null], { terms: { __field_1__: [null] } }],
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
        ])(
          'should generate a "boolean query" QueryDsl from a "%s" operator',
          (operator, value, expectedQuery) => {
            const conditionTree = new ConditionTreeLeaf('__field_1__', operator as Operator, value);

            const queryConverter = new QueryConverter();
            const query = queryConverter.getBoolQueryFromConditionTree(conditionTree);

            expect(query).toEqual(expectedQuery);
          },
        );

        // describe('whith "Like" operator', () => {
        //   it.each([
        //     [
        //       'mariadb',
        //       {
        //         attribute: { fn: 'BINARY', args: [{ col: '__field_1__' }] },
        //         comparator: 'LIKE',
        //         logic: 'VaLuE',
        //       },
        //     ],
        //     ['mssql', { [Op.like]: 'VaLuE' }],
        //     [
        //       'mysql',
        //       {
        //         attribute: { fn: 'BINARY', args: [{ col: '__field_1__' }] },
        //         comparator: 'LIKE',
        //         logic: 'VaLuE',
        //       },
        //     ],
        //     ['postgres', { [Op.like]: 'VaLuE' }],
        //   ])('should generate a "where" Sequelize filter for "%s"', (dialect, where) => {
        //     const tree = new ConditionTreeLeaf('__field_1__', 'Like', 'VaLuE');
        //     const model = setupModel(dialect as Dialect);
        //     const queryConverter = new QueryConverter(model);
        //     const sequelizeFilter = queryConverter.getBoolQueryFromConditionTree(tree);

        //     expect(sequelizeFilter).toHaveProperty('__field_1__', where);
        //   });
        // });

        // describe('with "ILike" operator', () => {
        //   it.each([
        //     ['mariadb', { [Op.like]: 'VaLuE' }],
        //     [
        //       'mssql',
        //       {
        //         attribute: { fn: 'LOWER', args: [{ col: '__field_1__' }] },
        //         comparator: 'LIKE',
        //         logic: 'value',
        //       },
        //     ],
        //     ['mysql', { [Op.like]: 'VaLuE' }],
        //     ['postgres', { [Op.iLike]: 'VaLuE' }],
        //   ])('should generate a "where" Sequelize filter for "%s"', (dialect, where) => {
        //     const tree = new ConditionTreeLeaf('__field_1__', 'ILike', 'VaLuE');
        //     const model = setupModel(dialect as Dialect);
        //     const queryConverter = new QueryConverter(model);
        //     const sequelizeFilter = queryConverter.getBoolQueryFromConditionTree(tree);

        //     expect(sequelizeFilter).toHaveProperty('__field_1__', where);
        //   });
        // });

        it('should fail with an invalid operator', () => {
          const queryConverter = new QueryConverter();

          expect(() =>
            queryConverter.getBoolQueryFromConditionTree(
              new ConditionTreeLeaf('__field_1__', '__invalid__' as Operator, '__value__'),
            ),
          ).toThrow('Unsupported operator: "__invalid__".');
        });
      });

      // Not sur to get this one
      // describe('with a renamed field', () => {
      //   it('should generate a valid where clause', () => {
      //     const conditionTree = new ConditionTreeLeaf('__renamed_field__', 'Equal', '__value__');

      //     const queryConverter = new QueryConverter();

      //     expect(queryConverter.getBoolQueryFromConditionTree(conditionTree)).toEqual({
      //       fieldRenamed: { term: '__value__' },
      //     });
      //   });
      // });

      // describe('with a condition tree acting on relation', () => {
      //   const setupModelWithRelation = () => {
      //     const model = setupModel();
      //     const relation = model.sequelize.define('relation', {
      //       __field_a__: {
      //         type: DataTypes.STRING,
      //         field: 'fieldNameA',
      //       },
      //     });
      //     const relationB = model.sequelize.define('relationB', {
      //       __field_b__: {
      //         type: DataTypes.STRING,
      //         field: 'fieldNameB',
      //       },
      //     });

      //     relation.belongsTo(relationB);
      //     model.belongsTo(relation);

      //     return model;
      //   };

      //   it('should generate a valid where clause', () => {
      //     const conditionTree = new ConditionTreeLeaf('relation:__field_a__', 'Equal', '__value__');
      //     const model = setupModelWithRelation();
      //     const queryConverter = new QueryConverter(model);

      //     expect(queryConverter.getBoolQueryFromConditionTree(conditionTree)).toEqual({
      //       '$relation.fieldNameA$': { [Op.eq]: '__value__' },
      //     });
      //   });

      //   describe('with deep relation', () => {
      //     it('should generate a valid where clause', () => {
      //       const conditionTree = new ConditionTreeLeaf(
      //         'relation:relationB:__field_b__',
      //         'Equal',
      //         '__value__',
      //       );

      //       const model = setupModelWithRelation();
      //       const queryConverter = new QueryConverter(model);

      //       expect(queryConverter.getBoolQueryFromConditionTree(conditionTree)).toEqual({
      //         '$relation.relationB.fieldNameB$': { [Op.eq]: '__value__' },
      //       });
      //     });
      //   });
      // });
    });

    // describe('with array operator', () => {
    //   it.each([
    //     ['In', Op.in],
    //     ['IncludesAll', Op.contains],
    //     ['NotIn', Op.notIn],
    //   ])('should handle array values "%s"', (operator, sequelizeOperator) => {
    //     const model = setupModel();
    //     const queryConverter = new QueryConverter(model);

    //     const sequelizeFilter = queryConverter.getBoolQueryFromConditionTree(
    //       new ConditionTreeLeaf('__field_1__', operator as Operator, [42, 43]),
    //     );

    //     expect(sequelizeFilter).toHaveProperty('__field_1__', { [sequelizeOperator]: [42, 43] });
    //   });
    // });
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
