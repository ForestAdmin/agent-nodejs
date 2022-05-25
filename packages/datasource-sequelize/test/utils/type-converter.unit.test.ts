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
            'Blank',
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
        ['Boolean', 'Boolean', ['Blank', 'Equal', 'Missing', 'NotEqual', 'Present']],
        [
          'Universally Unique Identifier',
          'Uuid',
          [
            'Blank',
            'Equal',
            'Missing',
            'NotEqual',
            'Present',
            'StartsWith',
            'EndsWith',
            'Contains',
            'Like',
          ],
        ],
        [
          'Numerical',
          'Number',
          [
            'Blank',
            'Equal',
            'GreaterThan',
            'In',
            'LessThan',
            'Missing',
            'NotEqual',
            'NotIn',
            'Present',
          ],
        ],
        [
          'Textual',
          'String',
          [
            'Blank',
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
          ['Blank', 'Equal', 'Missing', 'NotEqual', 'Present', 'LessThan', 'GreaterThan'],
        ],
        ['Enum', 'Enum', ['Blank', 'Equal', 'In', 'Missing', 'NotEqual', 'NotIn', 'Present']],
        ['JSON', 'Json', ['Blank', 'Equal', 'Missing', 'NotEqual', 'Present']],
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
