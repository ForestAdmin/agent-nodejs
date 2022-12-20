import { DateTime } from 'luxon';
import { validate as uuidValidate } from 'uuid';

import { PrimitiveTypes } from '../interfaces/schema';
import { ValidationPrimaryTypes, ValidationTypes, ValidationTypesArray } from './types';

export default class TypeGetter {
  static get(value: unknown, typeContext: PrimitiveTypes): PrimitiveTypes | ValidationTypes {
    if (Array.isArray(value)) return TypeGetter.getArrayType(value, typeContext);

    if (typeContext === 'Json') return 'Json';

    if (typeof value === 'string') return TypeGetter.getTypeFromString(value, typeContext);

    if (typeof value === 'number' && !Number.isNaN(Number(value))) return 'Number';

    if (value instanceof Date && DateTime.fromJSDate(value).isValid) return 'Date';

    if (typeof value === 'boolean') return 'Boolean';

    return ValidationPrimaryTypes.Null;
  }

  private static getArrayType(
    value: Array<unknown>,
    typeContext: PrimitiveTypes,
  ): ValidationTypes | PrimitiveTypes {
    if (!ValidationTypesArray[typeContext]) {
      throw new Error(`Type ${typeContext} is not supported in array`);
    }

    if (value.length === 0) {
      return ValidationTypesArray[typeContext];
    }

    if (TypeGetter.isArrayOf('Number', value, typeContext)) return ValidationTypesArray.Number;

    if (TypeGetter.isArrayOf('Uuid', value, typeContext)) return ValidationTypesArray.Uuid;

    if (TypeGetter.isArrayOf('Boolean', value, typeContext)) return ValidationTypesArray.Boolean;

    if (TypeGetter.isArrayOf('String', value, typeContext)) return ValidationTypesArray.String;

    if (TypeGetter.isArrayOf('Json', value, typeContext)) return ValidationTypesArray.Json;

    if (TypeGetter.isArrayOf('Enum', value, typeContext)) return ValidationTypesArray.Enum;

    throw new Error(`The given value ${value} is not supported`);
  }

  private static getDateType(value: string): PrimitiveTypes {
    const dateTime = DateTime.fromISO(value);

    if (dateTime.toISODate() === value) return 'Dateonly';

    if (dateTime.toISOTime().match(value)) return 'Timeonly';

    return 'Date';
  }

  private static getTypeFromString(value: string, typeContext: PrimitiveTypes): PrimitiveTypes {
    if (['Enum', 'String'].includes(typeContext)) return typeContext;

    if (uuidValidate(value)) return 'Uuid';

    if (TypeGetter.isValidDate(value)) return TypeGetter.getDateType(value);

    if (TypeGetter.isPoint(value, typeContext)) return 'Point';

    return 'String';
  }

  private static isValidDate(value: string): boolean {
    return DateTime.fromISO(value).isValid;
  }

  private static isPoint(value: string, typeContext: PrimitiveTypes): boolean {
    const potentialPoint = value.split(',');

    return (
      potentialPoint.length === 2 &&
      typeContext === 'Point' &&
      TypeGetter.get(potentialPoint.map(Number), 'Number') === ValidationTypesArray.Number
    );
  }

  private static isArrayOf(
    type: PrimitiveTypes,
    values: Array<unknown>,
    typeContext: PrimitiveTypes,
  ) {
    return values.every(item => TypeGetter.get(item, typeContext) === type);
  }
}
