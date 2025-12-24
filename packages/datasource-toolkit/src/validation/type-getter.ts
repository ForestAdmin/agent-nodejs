import type { ColumnType, PrimitiveTypes } from '../interfaces/schema';

import { DateTime } from 'luxon';
import { validate as uuidValidate } from 'uuid';

export default class TypeGetter {
  static get(value: unknown, typeContext: PrimitiveTypes): PrimitiveTypes {
    if (typeContext === 'Json') return 'Json';

    if (typeof value === 'string') return TypeGetter.getTypeFromString(value, typeContext);

    if (typeof value === 'number' && !Number.isNaN(Number(value))) return 'Number';

    if (value instanceof Date && DateTime.fromJSDate(value).isValid) return 'Date';

    if (typeof value === 'boolean') return 'Boolean';

    if (value instanceof Buffer) return 'Binary';

    if (value === null || value === undefined) return null;

    return undefined;
  }

  static isPrimitiveType(columnType: ColumnType): columnType is PrimitiveTypes {
    const primitiveTypes: PrimitiveTypes[] = [
      'Boolean',
      'Binary',
      'Date',
      'Dateonly',
      'Enum',
      'Json',
      'Number',
      'Point',
      'String',
      'Time',
      'Timeonly',
      'Uuid',
    ];

    return primitiveTypes.includes(columnType as PrimitiveTypes);
  }

  static isArrayOfPrimitiveType(columnType: ColumnType): columnType is [PrimitiveTypes] {
    return Array.isArray(columnType) && this.isPrimitiveType(columnType[0]);
  }

  private static getDateType(value: string): PrimitiveTypes {
    const dateTime = DateTime.fromISO(value);

    if (dateTime.toISODate() === value) return 'Dateonly';

    if (dateTime.toISOTime().match(value)) return 'Time';

    return 'Date';
  }

  private static getTypeFromString(value: string, typeContext: PrimitiveTypes): PrimitiveTypes {
    if (['Enum', 'String'].includes(typeContext)) return typeContext;

    if (uuidValidate(value)) return 'Uuid';

    if (TypeGetter.isValidDate(value)) return TypeGetter.getDateType(value);

    if (TypeGetter.isPoint(value, typeContext)) return 'Point';

    // BigInt
    if (typeContext === 'Number' && TypeGetter.isBigInt(value)) return typeContext;

    return 'String';
  }

  private static isBigInt(value: string): boolean {
    try {
      BigInt(value);

      return true;
    } catch (e) {
      /* empty */
    }

    return false;
  }

  private static isValidDate(value: string): boolean {
    return DateTime.fromISO(value).isValid;
  }

  private static isPoint(value: string, typeContext: PrimitiveTypes): boolean {
    const potentialPoint = value.split(',');

    return (
      potentialPoint.length === 2 &&
      typeContext === 'Point' &&
      potentialPoint.every(point => TypeGetter.get(Number(point), 'Number') === 'Number')
    );
  }
}
