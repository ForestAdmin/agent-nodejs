/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Aggregator,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Operator,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';
import { DataTypes, Dialect, Op, Sequelize } from 'sequelize';

import QueryConverter from '../../src/utils/query-converter';

describe('Utils > QueryConverter', () => {
  const setupModel = (dialect: Dialect = 'postgres') => {
    const sequelize = new Sequelize({ dialect });
    const model = sequelize.define('model', {
      __field_1__: {
        type: DataTypes.STRING,
      },
      __field_2__: {
        type: DataTypes.STRING,
      },
      __renamed_field__: {
        type: DataTypes.STRING,
        field: 'fieldRenamed',
      },
    });

    return model;
  };

  describe('getWhereFromConditionTreeToByPassInclude', () => {
    describe('with a condition tree acting on relation', () => {
      it('should generate a valid "where" clause with the primary keys', async () => {
        const conditionTree = new ConditionTreeLeaf('relation:__field__', 'Equal', '__value__');

        const sequelize = new Sequelize({ dialect: 'postgres' });
        const model = sequelize.define('model', {
          idA: {
            type: DataTypes.INTEGER,
            primaryKey: true,
          },
          idB: {
            type: DataTypes.INTEGER,
            primaryKey: true,
          },
        });
        const relation = sequelize.define('relation', {
          __field__: {
            type: DataTypes.STRING,
            field: 'fieldName',
          },
        });
        model.belongsTo(relation);

        model.findAll = jest
          .fn()
          .mockResolvedValue([
            { get: jest.fn().mockReturnValueOnce(1).mockReturnValueOnce(2) },
            { get: jest.fn().mockReturnValueOnce(3).mockReturnValueOnce(4) },
          ]);

        const queryConverter = new QueryConverter(model);
        const where = await queryConverter.getWhereFromConditionTreeToByPassInclude(conditionTree);

        expect(where).toEqual({
          [Op.or]: [
            { [Op.and]: [{ idA: { [Op.eq]: 1 } }, { idB: { [Op.eq]: 2 } }] },
            { [Op.and]: [{ idA: { [Op.eq]: 3 } }, { idB: { [Op.eq]: 4 } }] },
          ],
        });
      });
    });

    describe('with a condition tree without relation', () => {
      it('should generate a valid where clause with ids', async () => {
        const conditionTree = new ConditionTreeLeaf('__field_1__', 'Equal', '__value__');
        const model = setupModel();
        const queryConverter = new QueryConverter(model);
        const where = await queryConverter.getWhereFromConditionTreeToByPassInclude(conditionTree);

        expect(where).toEqual({ __field_1__: { [Op.eq]: '__value__' } });
      });
    });

    describe('without condition tree', () => {
      it('should generate a valid where clause with ids', async () => {
        const model = setupModel();
        const queryConverter = new QueryConverter(model);
        const where = await queryConverter.getWhereFromConditionTreeToByPassInclude(null);

        expect(where).toEqual({});
      });
    });
  });

  describe('getWhereFromConditionTree', () => {
    it('should fail with an invalid conditionTree', () => {
      const conditionTree = {
        operator: undefined,
      } as unknown as ConditionTreeBranch;

      const model = setupModel();
      const queryConverter = new QueryConverter(model);

      expect(() => queryConverter.getWhereFromConditionTree(conditionTree)).toThrow(
        'Invalid ConditionTree.',
      );
    });

    describe('with a condition tree', () => {
      describe('when a null condition tree is given', () => {
        it('should return an empty object', () => {
          const model = setupModel();
          const queryConverter = new QueryConverter(model);

          expect(queryConverter.getWhereFromConditionTree(null)).toEqual({});
        });
      });

      describe('with a ConditionTreeBranch node', () => {
        it('should fail when aggregator is empty', () => {
          const conditionTree = new ConditionTreeBranch(null, [
            new ConditionTreeLeaf('__field__', 'Equal', '__value__'),
            new ConditionTreeLeaf('__field__', 'Equal', '__value__'),
          ]);

          const model = setupModel();
          const queryConverter = new QueryConverter(model);

          expect(() => queryConverter.getWhereFromConditionTree(conditionTree)).toThrow(
            'Invalid (null) aggregator.',
          );
        });

        it('should throw an error when conditions is not an array', () => {
          const conditionTree = new ConditionTreeBranch('And', null);
          const model = setupModel();
          const queryConverter = new QueryConverter(model);

          expect(() => queryConverter.getWhereFromConditionTree(conditionTree)).toThrow(
            'Conditions must be an array.',
          );
        });

        it('should not throw an error when there is no condition', () => {
          const conditionTree = new ConditionTreeBranch('And', []);
          const model = setupModel();
          const queryConverter = new QueryConverter(model);

          expect(() => queryConverter.getWhereFromConditionTree(conditionTree)).not.toThrow();
        });

        describe('with only one condition', () => {
          it('should not throw an error with the And aggregator', () => {
            const conditionTree = new ConditionTreeBranch('And', [
              new ConditionTreeLeaf('__field_1__', 'Equal', '__value_1__'),
            ]);

            const model = setupModel();
            const queryConverter = new QueryConverter(model);

            expect(() => queryConverter.getWhereFromConditionTree(conditionTree)).not.toThrow();
          });

          it('should not throw an error with the Or aggregator', () => {
            const conditionTree = new ConditionTreeBranch('Or', [
              new ConditionTreeLeaf('__field_1__', 'Equal', '__value_1__'),
            ]);

            const model = setupModel();
            const queryConverter = new QueryConverter(model);

            expect(() => queryConverter.getWhereFromConditionTree(conditionTree)).not.toThrow();
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

            const model = setupModel();
            const queryConverter = new QueryConverter(model);

            expect(queryConverter.getWhereFromConditionTree(conditionTree)).toEqual({
              [operator]: [
                { [conditions[0].field]: { [Op.eq]: conditions[0].value } },
                { [conditions[1].field]: { [Op.eq]: conditions[1].value } },
              ],
            });
          },
        );
      });

      describe('with a ConditionTreeLeaf node', () => {
        const defaultArrayValue = [21, 42, 84];
        const defaultIntegerValue = 42;
        const defaultStringValue = 'VaLuE';

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
          [
            'NotContains',
            defaultStringValue,
            { [Op.not]: { [Op.like]: `%${defaultStringValue}%` } },
          ],
        ])(
          'should generate a "where" Sequelize filter from a "%s" operator',
          (operator, value, where) => {
            const conditionTree = new ConditionTreeLeaf('__field_1__', operator as Operator, value);

            const model = setupModel();
            const queryConverter = new QueryConverter(model);
            const sequelizeFilter = queryConverter.getWhereFromConditionTree(conditionTree);

            expect(sequelizeFilter).toHaveProperty('__field_1__', where);
          },
        );

        describe('whith "Like" operator', () => {
          it.each([
            [
              'mariadb',
              {
                attribute: { fn: 'BINARY', args: [{ col: '__field_1__' }] },
                comparator: 'LIKE',
                logic: 'VaLuE',
              },
            ],
            ['mssql', { [Op.like]: 'VaLuE' }],
            [
              'mysql',
              {
                attribute: { fn: 'BINARY', args: [{ col: '__field_1__' }] },
                comparator: 'LIKE',
                logic: 'VaLuE',
              },
            ],
            ['postgres', { [Op.like]: 'VaLuE' }],
            [
              'sqlite',
              {
                attribute: { col: '__field_1__' },
                comparator: 'GLOB',
                logic: 'VaLuE',
              },
            ],
          ])('should generate a "where" Sequelize filter for "%s"', (dialect, where) => {
            const tree = new ConditionTreeLeaf('__field_1__', 'Like', 'VaLuE');
            const model = setupModel(dialect as Dialect);
            const queryConverter = new QueryConverter(model);
            const sequelizeFilter = queryConverter.getWhereFromConditionTree(tree);

            expect(sequelizeFilter).toHaveProperty('__field_1__', where);
          });
        });

        describe('with "ILike" operator', () => {
          it.each([
            ['mariadb', { [Op.like]: 'VaLuE' }],
            [
              'mssql',
              {
                attribute: { fn: 'LOWER', args: [{ col: '__field_1__' }] },
                comparator: 'LIKE',
                logic: 'value',
              },
            ],
            ['mysql', { [Op.like]: 'VaLuE' }],
            ['postgres', { [Op.iLike]: 'VaLuE' }],
            ['sqlite', { [Op.like]: 'VaLuE' }],
          ])('should generate a "where" Sequelize filter for "%s"', (dialect, where) => {
            const tree = new ConditionTreeLeaf('__field_1__', 'ILike', 'VaLuE');
            const model = setupModel(dialect as Dialect);
            const queryConverter = new QueryConverter(model);
            const sequelizeFilter = queryConverter.getWhereFromConditionTree(tree);

            expect(sequelizeFilter).toHaveProperty('__field_1__', where);
          });
        });

        it('should fail with a null operator', () => {
          const model = setupModel();
          const queryConverter = new QueryConverter(model);

          expect(() =>
            queryConverter.getWhereFromConditionTree(
              new ConditionTreeLeaf('__field_1__', null, '__value__'),
            ),
          ).toThrow('Invalid (null) operator.');
        });

        it('should fail with an invalid operator', () => {
          const model = setupModel();
          const queryConverter = new QueryConverter(model);

          expect(() =>
            queryConverter.getWhereFromConditionTree(
              new ConditionTreeLeaf('__field_1__', '__invalid__' as Operator, '__value__'),
            ),
          ).toThrow('Unsupported operator: "__invalid__".');
        });
      });

      describe('with a renamed field', () => {
        it('should generate a valid where clause', () => {
          const conditionTree = new ConditionTreeLeaf('__renamed_field__', 'Equal', '__value__');
          const model = setupModel();
          const queryConverter = new QueryConverter(model);

          expect(queryConverter.getWhereFromConditionTree(conditionTree)).toEqual({
            fieldRenamed: { [Op.eq]: '__value__' },
          });
        });
      });

      describe('with a condition tree acting on relation', () => {
        const setupModelWithRelation = () => {
          const model = setupModel();
          const relation = model.sequelize.define('relation', {
            __field_a__: {
              type: DataTypes.STRING,
              field: 'fieldNameA',
            },
          });
          const relationB = model.sequelize.define('relationB', {
            __field_b__: {
              type: DataTypes.STRING,
              field: 'fieldNameB',
            },
          });

          relation.belongsTo(relationB);
          model.belongsTo(relation);

          return model;
        };

        it('should generate a valid where clause', () => {
          const conditionTree = new ConditionTreeLeaf('relation:__field_a__', 'Equal', '__value__');
          const model = setupModelWithRelation();
          const queryConverter = new QueryConverter(model);

          expect(queryConverter.getWhereFromConditionTree(conditionTree)).toEqual({
            '$relation.fieldNameA$': { [Op.eq]: '__value__' },
          });
        });

        describe('with deep relation', () => {
          it('should generate a valid where clause', () => {
            const conditionTree = new ConditionTreeLeaf(
              'relation:relationB:__field_b__',
              'Equal',
              '__value__',
            );

            const model = setupModelWithRelation();
            const queryConverter = new QueryConverter(model);

            expect(queryConverter.getWhereFromConditionTree(conditionTree)).toEqual({
              '$relation.relationB.fieldNameB$': { [Op.eq]: '__value__' },
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
          const model = setupModel();
          const queryConverter = new QueryConverter(model);

          const sequelizeFilter = queryConverter.getWhereFromConditionTree(
            new ConditionTreeLeaf('__field_1__', operator as Operator, 42),
          );

          expect(sequelizeFilter).toHaveProperty('__field_1__', { [sequelizeOperator]: [42] });
        });

        it('should handle array values', () => {
          const model = setupModel();
          const queryConverter = new QueryConverter(model);

          const sequelizeFilter = queryConverter.getWhereFromConditionTree(
            new ConditionTreeLeaf('__field_1__', operator as Operator, [42]),
          );

          expect(sequelizeFilter).toHaveProperty('__field_1__', { [sequelizeOperator]: [42] });
        });
      });
    });
  });

  describe('getOrderFromSort', () => {
    it('should omit the "order" clause when condition list is empty', () => {
      const model = setupModel();
      const queryConverter = new QueryConverter(model);

      expect(queryConverter.getOrderFromSort(new Sort())).toEqual([]);
    });

    it('should honor values from "sort"', () => {
      const sort = new Sort(
        { field: '__a__', ascending: true },
        { field: '__b__', ascending: false },
      );

      const model = setupModel();
      const queryConverter = new QueryConverter(model);

      expect(queryConverter.getOrderFromSort(sort)).toEqual([
        ['__a__', 'ASC'],
        ['__b__', 'DESC'],
      ]);
    });
  });

  describe('getIncludeWithAttributesFromProjection', () => {
    describe('when projection have relation field', () => {
      it('should add include with attributes', () => {
        const projection = new Projection('model:another_field');
        const model = setupModel();
        const queryConverter = new QueryConverter(model);

        expect(queryConverter.getIncludeWithAttributesFromProjection(projection)).toEqual([
          { association: 'model', include: [], attributes: ['another_field'] },
        ]);
      });

      it('should add include recursively with attributes', () => {
        const projection = new Projection('model:another_model:a_field');
        const model = setupModel();
        const queryConverter = new QueryConverter(model);

        expect(queryConverter.getIncludeWithAttributesFromProjection(projection)).toEqual([
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
        const model = setupModel();
        const queryConverter = new QueryConverter(model);

        expect(queryConverter.getIncludeFromProjection(projection)).toEqual([
          { association: 'model', include: [], attributes: [] },
        ]);
      });

      it('should add include recursively', () => {
        const projection = new Projection('model:another_model:a_field');
        const model = setupModel();
        const queryConverter = new QueryConverter(model);

        expect(queryConverter.getIncludeFromProjection(projection)).toEqual([
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
