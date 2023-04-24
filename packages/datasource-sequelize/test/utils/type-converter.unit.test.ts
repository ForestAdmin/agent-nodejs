import { ColumnType, Operator } from '@forestadmin/datasource-toolkit';
import { DataTypes } from 'sequelize';

import TypeConverter from '../../src/utils/type-converter';

describe('Utils > TypeConverter', () => {
  describe('fromDataType', () => {
    it('should throw an error with an unsupported data type', () => {
      expect(() => TypeConverter.fromDataType(DataTypes.VIRTUAL())).toThrow(
        'Unsupported data type: "VIRTUAL"',
      );
    });

    it('should return a column type when known', () => {
      expect(TypeConverter.fromDataType(DataTypes.BOOLEAN())).toBe('Boolean');
      expect(TypeConverter.fromDataType(DataTypes.BLOB())).toBe('Binary');
      expect(TypeConverter.fromDataType(DataTypes.DATEONLY())).toBe('Dateonly');
      expect(TypeConverter.fromDataType(DataTypes.TIME())).toBe('Timeonly');
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
      ['Binary', [...presence, ...equality]],
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
