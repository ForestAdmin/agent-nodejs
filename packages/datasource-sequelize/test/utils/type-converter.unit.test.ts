import { ColumnType, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { DataTypes } from 'sequelize';

import TypeConverter from '../../src/utils/type-converter';

describe('Utils > TypeConverter', () => {
  describe('fromColumnType', () => {
    it('should throw with an unknown column type', () => {
      expect(() => TypeConverter.fromColumnType('__unknown__' as PrimitiveTypes)).toThrow(
        'Unsupported column type: "__unknown__".',
      );
    });

    it('should return a Sequelize data type when known', () => {
      expect(TypeConverter.fromColumnType('Boolean')).toBe(DataTypes.BOOLEAN);
    });
  });

  describe('fromDataType', () => {
    it('should throw an error with an unsupported data type', () => {
      expect(() => TypeConverter.fromDataType(DataTypes.VIRTUAL())).toThrow(
        'Unsupported data type: "VIRTUAL"',
      );
    });

    it('should return a column type when known', () => {
      expect(TypeConverter.fromDataType(DataTypes.BOOLEAN())).toBe('Boolean');
    });

    it('should return an array column type when needed', () => {
      expect(TypeConverter.fromDataType(DataTypes.ARRAY(DataTypes.BOOLEAN))).toStrictEqual([
        'Boolean',
      ]);
    });
  });

  describe('operatorsForColumnType', () => {
    describe('with an array type', () => {
      it('should return the matching set of operators', () => {
        expect(TypeConverter.operatorsForColumnType(['Boolean'])).toEqual(
          new Set<Operator>([
            'Equal',
            'In',
            'IncludesAll',
            'Missing',
            'NotEqual',
            'NotIn',
            'Present',
          ]),
        );
      });
    });

    describe('with a non-array type', () => {
      describe.each([
        ['Boolean', 'Boolean', ['Equal', 'Missing', 'NotEqual', 'Present']],
        [
          'Universally Unique Identifier',
          'Uuid',
          ['Equal', 'Missing', 'NotEqual', 'Present', 'StartsWith', 'EndsWith', 'Contains', 'Like'],
        ],
        [
          'Numerical',
          'Number',
          ['Equal', 'GreaterThan', 'In', 'LessThan', 'Missing', 'NotEqual', 'NotIn', 'Present'],
        ],
        [
          'Textual',
          'String',
          [
            'Equal',
            'In',
            'Like',
            'ILike',
            'LongerThan',
            'Missing',
            'NotContains',
            'NotEqual',
            'NotIn',
            'Present',
            'ShorterThan',
          ],
        ],
        [
          'Temporal',
          'Date',
          ['Equal', 'Missing', 'NotEqual', 'Present', 'LessThan', 'GreaterThan'],
        ],
        ['Enum', 'Enum', ['Equal', 'In', 'Missing', 'NotEqual', 'NotIn', 'Present']],
        ['JSON', 'Json', ['Equal', 'Missing', 'NotEqual', 'Present']],
        ['Unsupported', 'Blob', []],
      ])('with "%s" types', (message, dataType, operatorList) => {
        it('should return the matching set of operators for type "%s"', () => {
          expect(TypeConverter.operatorsForColumnType(dataType as ColumnType)).toEqual(
            new Set<Operator>(operatorList as Operator[]),
          );
        });
      });
    });
  });
});
