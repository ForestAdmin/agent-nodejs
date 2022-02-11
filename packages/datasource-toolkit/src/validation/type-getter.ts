import { DateTime } from 'luxon';
import { validate as uuidValidate } from 'uuid';

import { PrimitiveTypes } from '../interfaces/schema';
import ValidationError from '../errors';
import ValidationTypes from './types';

export default class TypeGetter {
  static get(
    value: unknown,
    typeContext?: PrimitiveTypes,
  ): PrimitiveTypes | ValidationTypes | null {
    if (typeContext && !Object.values(PrimitiveTypes).includes(typeContext)) {
      throw new ValidationError(`Unexpected value of type: ${typeContext}`);
    }

    if (Array.isArray(value)) return TypeGetter.getArrayType(value, typeContext);

    if (typeof value === 'string') return TypeGetter.getTypeFromString(value, typeContext);

    if (typeof value === 'number') return PrimitiveTypes.Number;

    if (value instanceof Date && DateTime.fromJSDate(value).isValid) return PrimitiveTypes.Date;

    if (typeof value === 'boolean') return PrimitiveTypes.Boolean;

    if (typeof value === 'object' && PrimitiveTypes.Json === typeContext)
      return PrimitiveTypes.Json;

    return null;
  }

  private static getArrayType(
    value: Array<unknown>,
    typeContext?: PrimitiveTypes,
  ): ValidationTypes | PrimitiveTypes | null {
    if (value.length === 0) return ValidationTypes.EmptyArray;

    if (TypeGetter.isArrayOf(PrimitiveTypes.Number, value)) return ValidationTypes.ArrayOfNumber;

    if (TypeGetter.isArrayOf(PrimitiveTypes.Uuid, value)) return ValidationTypes.ArrayOfUuid;

    if (TypeGetter.isArrayOf(PrimitiveTypes.Boolean, value)) return ValidationTypes.ArrayOfBoolean;

    if (TypeGetter.isArrayOf(PrimitiveTypes.String, value)) {
      return typeContext === PrimitiveTypes.Enum
        ? ValidationTypes.ArrayOfEnum
        : ValidationTypes.ArrayOfString;
    }

    return null;
  }

  private static getDateType(value: string): PrimitiveTypes {
    const dateTime = DateTime.fromISO(value);

    if (dateTime.toISODate() === value) return PrimitiveTypes.Dateonly;

    if (dateTime.toISOTime().match(value)) return PrimitiveTypes.Timeonly;

    return PrimitiveTypes.Date;
  }

  private static getTypeFromString(value: string, typeContext?: PrimitiveTypes): PrimitiveTypes {
    if ([PrimitiveTypes.Enum, PrimitiveTypes.String].includes(typeContext)) return typeContext;

    if (uuidValidate(value)) return PrimitiveTypes.Uuid;

    if (TypeGetter.isNumberAndContextAllowToCast(value, typeContext)) return PrimitiveTypes.Number;

    if (TypeGetter.isValidDate(value)) return TypeGetter.getDateType(value);

    if (TypeGetter.isJson(value)) return PrimitiveTypes.Json;

    if (TypeGetter.isPoint(value, typeContext)) return PrimitiveTypes.Point;

    return PrimitiveTypes.String;
  }

  private static isValidDate(value: string): boolean {
    return DateTime.fromISO(value).isValid;
  }

  private static isPoint(value: string, typeContext: PrimitiveTypes): boolean {
    const potentialPoint = value.split(',');

    return (
      potentialPoint.length === 2 &&
      typeContext === PrimitiveTypes.Point &&
      TypeGetter.get(potentialPoint) === ValidationTypes.ArrayOfNumber
    );
  }

  private static isNumberAndContextAllowToCast(
    value: string,
    typeContext: PrimitiveTypes,
  ): boolean {
    // @see https://stackoverflow.com/questions/175739
    return (
      !Number.isNaN(Number(value)) &&
      !Number.isNaN(parseFloat(value)) &&
      typeContext !== PrimitiveTypes.Number
    );
  }

  private static isJson(value: string): boolean {
    try {
      return !!JSON.parse(value);
    } catch {
      return false;
    }
  }

  private static isArrayOf(type: PrimitiveTypes, values: Array<unknown>) {
    return values.every(item => TypeGetter.get(item) === type);
  }
}
