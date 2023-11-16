import { MappingFieldType } from '@elastic/elasticsearch/api/types';
import { ColumnType, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

export default class TypeConverter {
  public static fromDataType(dataType: MappingFieldType): ColumnType {
    return TypeConverter.getColumnTypeFromDataType(dataType);
  }

  /**
   * https://www.elastic.co/guide/en/elasticsearch/reference/master/mapping-types.html#mapping-types
   */
  private static getColumnTypeFromDataType(dataType: MappingFieldType): PrimitiveTypes {
    switch (dataType) {
      case 'boolean':
        return 'Boolean';

      case 'date_nanos':
      case 'date':
        return 'Date';

      case 'nested':
        return 'Json';

      case 'integer':
      case 'long':
      case 'short':
      case 'byte':
      case 'float':
      case 'half_float':
      case 'scaled_float':
      case 'double':
        return 'Number';

      case 'keyword':
      case 'constant_keyword':
      case 'text':
      case 'search_as_you_type':
        return 'String';

      case 'ip':
        // case 'version':
        return 'String';

      case 'binary':
        return 'String';

      case 'geo_point':
        return 'Point';

      // NOT supported by frontend let's say this is JSON?
      case 'integer_range':
      case 'float_range':
      case 'long_range':
      case 'double_range':
      case 'date_range':
      case 'ip_range':
      case 'object':
        return 'Json';

      // return 'Uuid';
      default:
        throw new Error(`Unsupported data type: "${dataType}"`);

      // completion?
      // percolator?
    }
  }

  public static isSortable(dataType: MappingFieldType): boolean {
    return dataType !== 'text';
  }

  public static operatorsForColumnType(columnType: ColumnType): Set<Operator> {
    const result: Operator[] = ['Present', 'Missing'];
    const equality: Operator[] = ['Equal', 'NotEqual', 'In', 'NotIn'];

    if (typeof columnType === 'string') {
      const orderables: Operator[] = ['LessThan', 'GreaterThan'];
      const strings: Operator[] = ['Like', 'ILike', 'NotContains'];

      if (['Boolean', 'Enum', 'Uuid'].includes(columnType)) {
        result.push(...equality);
      }

      if (['Date', 'Dateonly', 'Number'].includes(columnType)) {
        result.push(...equality, ...orderables);
      }

      if (['String'].includes(columnType)) {
        result.push(...equality, ...orderables, ...strings);
      }
    }

    // In Elasticsearch, there is no dedicated array data type.
    // Any field can contain zero or more values by default, however, all values
    // in the array must be of the same data type
    // https://www.elastic.co/guide/en/elasticsearch/reference/master/array.html
    // if (Array.isArray(columnType)) {
    // }

    result.push(...equality, 'IncludesAll');

    return new Set(result);
  }

  public static operatorsForId(): Set<Operator> {
    // _id field is accessible in queries such as term, terms, match, and query_string
    // https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-id-field.html
    return new Set(['Present', 'Missing', 'Equal', 'NotEqual', 'In', 'NotIn']);
  }
}
