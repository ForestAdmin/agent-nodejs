import { DataTypes } from 'sequelize';
import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import TypeConverter from '../../src/utils/typeConverter';

describe('Utils > TypeConverter', () => {
  describe('fromColumnType', () => {
    it('should throw with an unknown column type', () => {
      expect(() => TypeConverter.fromColumnType('__unknown__')).toThrow(
        'Unsupported column type: "__unknown__".',
      );
    });

    it('should return a Sequelize data type when known', () => {
      expect(TypeConverter.fromColumnType(PrimitiveTypes.Boolean)).toBe(DataTypes.BOOLEAN);
    });
  });

  describe('fromDataType', () => {
    it('should throw with an unknown data type', () => {
      expect(() => TypeConverter.fromDataType('__unknown__')).toThrow(
        'Unsupported data type: "__unknown__".',
      );
    });

    it('should return a column type when known', () => {
      expect(TypeConverter.fromDataType(DataTypes.BOOLEAN)).toBe(PrimitiveTypes.Boolean);
    });
  });
});
