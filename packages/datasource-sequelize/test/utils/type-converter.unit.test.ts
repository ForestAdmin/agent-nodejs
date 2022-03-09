import { DataTypes } from 'sequelize';
import { Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

import TypeConverter from '../../src/utils/type-converter';

describe('Utils > TypeConverter', () => {
  describe('fromColumnType', () => {
    it('should throw with an unknown column type', () => {
      expect(() => TypeConverter.fromColumnType('__unknown__' as PrimitiveTypes)).toThrow(
        'Unsupported column type: "__unknown__".',
      );
    });

    it('should return a Sequelize data type when known', () => {
      expect(TypeConverter.fromColumnType(PrimitiveTypes.Boolean)).toBe(DataTypes.BOOLEAN);
    });
  });

  describe('fromDataType', () => {
    it('should throw with an unsupported data type', () => {
      expect(() => TypeConverter.fromDataType(DataTypes.VIRTUAL)).toThrow(
        'Unsupported data type: "VIRTUAL".',
      );
    });

    it('should return a column type when known', () => {
      expect(TypeConverter.fromDataType(DataTypes.BOOLEAN)).toBe(PrimitiveTypes.Boolean);
    });

    it('should return an array column type when needed', () => {
      expect(TypeConverter.fromDataType(DataTypes.ARRAY(DataTypes.BOOLEAN))).toStrictEqual([
        PrimitiveTypes.Boolean,
      ]);
    });
  });

  describe('operatorsForDataType', () => {
    describe('with an array type', () => {
      it('should return the matching set of operators', () => {
        expect(TypeConverter.operatorsForDataType(DataTypes.ARRAY(DataTypes.BOOLEAN))).toEqual(
          new Set<Operator>([
            Operator.Blank,
            Operator.Equal,
            Operator.In,
            Operator.IncludesAll,
            Operator.Missing,
            Operator.NotEqual,
            Operator.NotIn,
            Operator.Present,
          ]),
        );
      });
    });

    describe('with a non-array type', () => {
      describe.each([
        [
          'Boolean',
          [DataTypes.BOOLEAN],
          [Operator.Blank, Operator.Equal, Operator.Missing, Operator.NotEqual, Operator.Present],
        ],
        [
          'Universally Unique Identifier',
          [DataTypes.UUID],
          [
            Operator.Blank,
            Operator.Equal,
            Operator.Missing,
            Operator.NotEqual,
            Operator.Present,
            Operator.StartsWith,
            Operator.EndsWith,
            Operator.Contains,
            Operator.Like,
          ],
        ],
        [
          'Numerical',
          [DataTypes.BIGINT],
          [
            Operator.Blank,
            Operator.Equal,
            Operator.GreaterThan,
            Operator.In,
            Operator.LessThan,
            Operator.Missing,
            Operator.NotEqual,
            Operator.NotIn,
            Operator.Present,
          ],
        ],
        [
          'Textual',
          [DataTypes.CHAR],
          [
            Operator.Blank,
            Operator.Contains,
            Operator.EndsWith,
            Operator.Equal,
            Operator.In,
            Operator.Like,
            Operator.LongerThan,
            Operator.Missing,
            Operator.NotContains,
            Operator.NotEqual,
            Operator.NotIn,
            Operator.Present,
            Operator.ShorterThan,
            Operator.StartsWith,
          ],
        ],
        [
          'Temporal',
          [DataTypes.DATE],
          [
            Operator.Blank,
            Operator.Equal,
            Operator.Missing,
            Operator.NotEqual,
            Operator.Present,
            Operator.LessThan,
            Operator.GreaterThan,
          ],
        ],
        [
          'Enum',
          [DataTypes.ENUM],
          [
            Operator.Blank,
            Operator.Equal,
            Operator.In,
            Operator.Missing,
            Operator.NotEqual,
            Operator.NotIn,
            Operator.Present,
          ],
        ],
        [
          'JSON',
          [DataTypes.JSON],
          [Operator.Blank, Operator.Equal, Operator.Missing, Operator.NotEqual, Operator.Present],
        ],
        ['Unsupported', [DataTypes.BLOB], []],
      ])('with "%s" types', (message, dataTypes, operatorList) => {
        it.each([dataTypes])(
          'should return the matching set of operators for type "%s"',
          dataType => {
            expect(TypeConverter.operatorsForDataType(dataType)).toEqual(
              new Set<Operator>(operatorList),
            );
          },
        );
      });
    });
  });
});
