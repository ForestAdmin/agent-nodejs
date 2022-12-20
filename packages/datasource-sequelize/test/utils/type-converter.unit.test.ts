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
    const presence = ['Present', 'Missing'] as const;
    const equality = ['Equal', 'NotEqual', 'In', 'NotIn'] as const;
    const orderables = ['LessThan', 'GreaterThan'] as const;
    const strings = ['Like', 'ILike', 'NotContains'] as const;

    it.each([
      // Primitive type
      ['Boolean', [...presence, ...equality]],
      ['Date', [...presence, ...equality, ...orderables]],
      ['Enum', [...presence, ...equality]],
      ['Number', [...presence, ...equality, ...orderables]],
      ['String', [...presence, ...equality, ...orderables, ...strings]],
      ['Uuid', [...presence, ...equality]],

      // Array type
      [['Boolean'], [...presence, ...equality, 'IncludesAll']],

      // Composite and unsupported types
      ['Json', presence],
      [{ a: 'String' }, presence],
      ['I_am_not_a_suported_type', presence],
    ])('should return the matching set of operators for type "%s"', (dataType, operatorList) => {
      expect(TypeConverter.operatorsForColumnType(dataType as ColumnType)).toEqual(
        new Set<Operator>(operatorList as Operator[]),
      );
    });
  });
});
