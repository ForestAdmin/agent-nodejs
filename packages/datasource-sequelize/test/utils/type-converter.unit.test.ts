import { DataTypes } from 'sequelize';
import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';

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
});
