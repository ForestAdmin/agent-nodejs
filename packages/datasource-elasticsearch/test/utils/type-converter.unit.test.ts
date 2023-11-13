import { MappingFieldType } from '@elastic/elasticsearch/api/types';
import { ColumnType, Operator } from '@forestadmin/datasource-toolkit';

import TypeConverter from '../../src/utils/type-converter';

describe('Utils > TypeConverter', () => {
  describe('fromDataType', () => {
    it('should throw with an unknown column type', () => {
      expect(() => TypeConverter.fromDataType('__unknown__' as MappingFieldType)).toThrow(
        'Unsupported data type: "__unknown__"',
      );
    });

    it.each([
      ['boolean', 'Boolean'],
      ['date_nanos', 'Date'],
      ['date', 'Date'],
      // Number
      ['integer', 'Number'],
      ['long', 'Number'],
      ['short', 'Number'],
      ['byte', 'Number'],
      ['float', 'Number'],
      ['half_float', 'Number'],
      ['scaled_float', 'Number'],
      ['double', 'Number'],
      // String
      ['keyword', 'String'],
      ['constant_keyword', 'String'],
      ['text', 'String'],
      // Other String
      ['ip', 'String'],
      ['binary', 'String'],
      // Point
      ['geo_point', 'Point'],
      // JSON
      ['nested', 'Json'],
      ['integer_range', 'Json'],
      ['float_range', 'Json'],
      ['long_range', 'Json'],
      ['double_range', 'Json'],
      ['date_range', 'Json'],
      ['ip_range', 'Json'],
    ])('should return a PrimitiveTypes when known for type "%s"', (dataType, primitiveType) => {
      expect(TypeConverter.fromDataType(dataType as MappingFieldType)).toEqual(primitiveType);
    });

    it.each([
      ['none'],
      ['histogram'],
      ['rank_feature'],
      ['rank_features'],
      ['flattened'],
      ['shape'],
      ['aggregate_metric_double'],
      ['dense_vector'],
      ['murmur3'],
      ['token_count'],
      ['percolator'],
      ['completion'],
    ])('should throw an error with an unsupported data type %s', dataType => {
      expect(() => TypeConverter.fromDataType(dataType as MappingFieldType)).toThrow(
        `Unsupported data type: "${dataType}"`,
      );
    });
  });

  describe('operatorsForColumnType', () => {
    const presence = ['Present', 'Missing', 'IncludesAll'] as const;
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

      // Composite and unsupported types
      ['Json', [...presence, ...equality]],
      [{ a: 'String' }, [...presence, ...equality]],
      ['I_am_not_a_suported_type', [...presence, ...equality]],
    ])('should return the matching set of operators for type "%s"', (dataType, operatorList) => {
      expect(TypeConverter.operatorsForColumnType(dataType as ColumnType)).toEqual(
        new Set<Operator>(operatorList as Operator[]),
      );
    });
  });
});
