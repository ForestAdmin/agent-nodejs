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
      expect(TypeConverter.fromColumnType('Boolean')).toBe(DataTypes.BOOLEAN);
    });
  });

  describe('fromDataType', () => {
    it('should throw with an unsupported data type', () => {
      expect(() => TypeConverter.fromDataType(DataTypes.VIRTUAL)).toThrow(
        'Unsupported data type: "VIRTUAL".',
      );
    });

    it('should return a column type when known', () => {
      expect(TypeConverter.fromDataType(DataTypes.BOOLEAN)).toBe('Boolean');
    });

    it('should return an array column type when needed', () => {
      expect(TypeConverter.fromDataType(DataTypes.ARRAY(DataTypes.BOOLEAN))).toStrictEqual([
        'Boolean',
      ]);
    });
  });

  describe('operatorsForDataType', () => {
    describe('with an array type', () => {
      it('should return the matching set of operators', () => {
        expect(TypeConverter.operatorsForDataType(DataTypes.ARRAY(DataTypes.BOOLEAN))).toEqual(
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
        ['Boolean', [DataTypes.BOOLEAN], ['Blank', 'Equal', 'Missing', 'NotEqual', 'Present']],
        [
          'Universally Unique Identifier',
          [DataTypes.UUID],
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
          [DataTypes.BIGINT],
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
          [DataTypes.CHAR],
          [
            'Blank',
            'Contains',
            'EndsWith',
            'Equal',
            'In',
            'Like',
            'LongerThan',
            'Missing',
            'NotContains',
            'NotEqual',
            'NotIn',
            'Present',
            'ShorterThan',
            'StartsWith',
          ],
        ],
        [
          'Temporal',
          [DataTypes.DATE],
          ['Blank', 'Equal', 'Missing', 'NotEqual', 'Present', 'LessThan', 'GreaterThan'],
        ],
        [
          'Enum',
          [DataTypes.ENUM],
          ['Blank', 'Equal', 'In', 'Missing', 'NotEqual', 'NotIn', 'Present'],
        ],
        ['JSON', [DataTypes.JSON], ['Blank', 'Equal', 'Missing', 'NotEqual', 'Present']],
        ['Unsupported', [DataTypes.BLOB], []],
      ])('with "%s" types', (message, dataTypes, operatorList) => {
        it.each([dataTypes])(
          'should return the matching set of operators for type "%s"',
          dataType => {
            expect(TypeConverter.operatorsForDataType(dataType)).toEqual(
              new Set<Operator>(operatorList as Operator[]),
            );
          },
        );
      });
    });
  });
});
