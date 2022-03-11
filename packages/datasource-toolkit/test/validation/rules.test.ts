import {
  MAP_ALLOWED_OPERATORS_FOR_COLUMN_TYPE,
  MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE,
  MAP_ALLOWED_TYPES_FOR_OPERATOR,
} from '../../src/validation/rules';
import { Operator } from '../../src/interfaces/query/condition-tree/nodes/leaf';
import { PrimitiveTypes } from '../../src/interfaces/schema';
import { ValidationPrimaryTypes } from '../../src/validation/types';

describe('ConditionTreeFactory', () => {
  describe('MAP_ALLOWED_TYPES_FOR_OPERATOR', () => {
    it.each(Object.values(Operator))(`should implement %s operator`, async operator => {
      expect(MAP_ALLOWED_TYPES_FOR_OPERATOR[operator]).toBeDefined();
    });
  });

  describe('MAP_ALLOWED_OPERATORS_FOR_COLUMN_TYPE', () => {
    it.each(Object.values(PrimitiveTypes))(`should implement %s primitive type`, async type => {
      expect(MAP_ALLOWED_OPERATORS_FOR_COLUMN_TYPE[type]).toBeDefined();
    });
  });

  describe('MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE', () => {
    it.each(Object.values(PrimitiveTypes))(`should implement %s primitive type`, async type => {
      expect(MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE[type]).toBeDefined();
    });

    it.each(Object.values(PrimitiveTypes))('should support the Null value', async type => {
      expect(MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE[type].includes(ValidationPrimaryTypes.Null)).toEqual(
        true,
      );
    });
  });
});
