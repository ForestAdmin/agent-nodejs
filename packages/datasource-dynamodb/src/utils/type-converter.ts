import type { DynamoDataType } from '../types';
import type { ColumnType, Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

import { allowedOperatorsForColumnType } from '@forestadmin/datasource-toolkit';

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?$/;
const NON_SORTABLE_TYPES: DynamoDataType[] = ['object', 'array', 'point', 'null'];

function isGeoPoint(value: unknown): boolean {
  const point = value as { type?: unknown; coordinates?: unknown };

  return (
    typeof value === 'object' &&
    point.type === 'Point' &&
    Array.isArray(point.coordinates) &&
    point.coordinates.length >= 2 &&
    point.coordinates.every(coordinate => typeof coordinate === 'number')
  );
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

export default class TypeConverter {
  static getColumnTypeFromDataType(dataType: DynamoDataType): PrimitiveTypes {
    switch (dataType) {
      case 'boolean':
        return 'Boolean';
      case 'date':
        return 'Date';
      case 'dateonly':
        return 'Dateonly';
      case 'timeonly':
        return 'Time';
      case 'number':
        return 'Number';
      case 'string':
      case 'binary':
        return 'String';
      case 'point':
      case 'object':
      case 'array':
      case 'null':
        return 'Json';
      default:
        throw new Error(`Unsupported data type: "${dataType}"`);
    }
  }

  /** DynamoDB only types its keys, so the other attributes are typed from their values. */
  static inferTypeFromValue(value: unknown): DynamoDataType {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';

    if (typeof value === 'string') {
      if (TIME_ONLY.test(value)) return 'timeonly';
      if (DATE_ONLY.test(value) && isValidDate(value)) return 'dateonly';
      if (ISO_DATE_TIME.test(value) && isValidDate(value)) return 'date';

      return 'string';
    }

    if (Array.isArray(value) || value instanceof Set) return 'array';
    if (value instanceof Date) return 'date';
    if (value instanceof Uint8Array) return 'binary';
    if (typeof value === 'object') return isGeoPoint(value) ? 'point' : 'object';

    return 'string';
  }

  static isGeoPoint(value: unknown): boolean {
    return isGeoPoint(value);
  }

  static getMostSpecificType(types: DynamoDataType[]): DynamoDataType {
    const unique = [...new Set(types)];
    const nonNull = unique.filter(type => type !== 'null');

    if (unique.length === 0) return 'null';
    if (nonNull.length === 0) return 'null';
    if (nonNull.length === 1) return nonNull[0];

    if (nonNull.every(type => type === 'date' || type === 'dateonly')) return 'date';

    return 'object';
  }

  static isSortable(dataType: DynamoDataType): boolean {
    return !NON_SORTABLE_TYPES.includes(dataType);
  }

  /**
   * Every operator Forest allows for the type: the ones DynamoDB cannot evaluate are applied
   * on the items it returns.
   */
  static operatorsForColumnType(columnType: ColumnType): Set<Operator> {
    return new Set(
      typeof columnType === 'string' ? allowedOperatorsForColumnType[columnType] : ['Present'],
    );
  }
}
