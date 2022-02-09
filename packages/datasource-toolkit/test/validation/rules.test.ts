import { Operator } from '../../src/interfaces/query/condition-tree/nodes/leaf';
import { PrimitiveTypes } from '../../src/interfaces/schema';
import {
  MAP_ALLOWED_OPERATORS_IN_FILTER_FOR_COLUMN_TYPE,
  MAP_ALLOWED_TYPES_FOR_OPERATOR_IN_FILTER,
  MAP_ALLOWED_TYPES_IN_FILTER_FOR_COLUMN_TYPE,
} from '../../src/validation/rules';

describe('ConditionTreeFactory', () => {
  describe('MAP_ALLOWED_TYPES_FOR_OPERATOR_IN_FILTER', () => {
    it.each(Object.values(Operator))(`should implement %s operator`, async operator => {
      expect(MAP_ALLOWED_TYPES_FOR_OPERATOR_IN_FILTER[operator]).toBeDefined();
    });
  });

  describe('MAP_ALLOWED_OPERATORS_IN_FILTER_FOR_COLUMN_TYPE', () => {
    it.each(Object.values(PrimitiveTypes))(`should implement %s primitive type`, async type => {
      expect(MAP_ALLOWED_OPERATORS_IN_FILTER_FOR_COLUMN_TYPE[type]).toBeDefined();
    });
  });

  describe('MAP_ALLOWED_TYPES_FOR_COLUMN_TYPE', () => {
    it.each(Object.values(PrimitiveTypes))(`should implement %s primitive type`, async type => {
      expect(MAP_ALLOWED_TYPES_IN_FILTER_FOR_COLUMN_TYPE[type]).toBeDefined();
    });
  });
});
