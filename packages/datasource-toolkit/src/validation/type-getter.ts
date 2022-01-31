import { DateTime } from 'luxon';
import { validate as uuidValidate } from 'uuid';
import { PrimitiveTypes } from '../interfaces/schema';
import ValidationTypes from './types';

export default class TypeGetter {
  static get(
    value: unknown,
    typeContext?: PrimitiveTypes,
  ): PrimitiveTypes | ValidationTypes | null {
    if (typeContext && !Object.values(PrimitiveTypes).includes(typeContext)) {
      throw new Error(`Unexpected value of type: ${typeContext}`);
    }

    if (Array.isArray(value)) {
      return TypeGetter.getArrayType(value, typeContext);
    }

    if (typeof value === 'string') {
      return TypeGetter.getTypeFromString(value, typeContext);
    }

    if (typeof value === 'number') {
      return PrimitiveTypes.Number;
    }

    if (value instanceof Date && DateTime.fromJSDate(value).isValid) {
      return PrimitiveTypes.Date;
    }

    if (typeof value === 'boolean') {
      return PrimitiveTypes.Boolean;
    }

    if (typeof value === 'object' && PrimitiveTypes.Json === typeContext) {
      return PrimitiveTypes.Json;
    }

    return null;
  }

  private static getArrayType(
    value: Array<unknown>,
    typeContext?: PrimitiveTypes,
  ): ValidationTypes | PrimitiveTypes | null {
    if (value.length === 0) {
      return ValidationTypes.EmptyArray;
    }

    if (value.every(item => TypeGetter.get(item) === PrimitiveTypes.Number)) {
      return ValidationTypes.ArrayOfNumber;
    }

    const isArrayOfString = value.every(item => TypeGetter.get(item) === PrimitiveTypes.String);

    if (isArrayOfString) {
      return typeContext === PrimitiveTypes.Enum
        ? ValidationTypes.ArrayOfEnum
        : ValidationTypes.ArrayOfString;
    }

    if (value.every(item => TypeGetter.get(item) === PrimitiveTypes.Boolean)) {
      return ValidationTypes.ArrayOfBoolean;
    }

    return null;
  }

  private static getDateType(value: string, dateTime: DateTime): PrimitiveTypes {
    if (dateTime.toISODate() === value) {
      return PrimitiveTypes.Dateonly;
    }

    if (dateTime.toISOTime().match(value)) {
      return PrimitiveTypes.Timeonly;
    }

    return PrimitiveTypes.Date;
  }

  private static getTypeFromString(value: string, typeContext?: PrimitiveTypes): PrimitiveTypes {
    if (typeContext === PrimitiveTypes.Enum) {
      return PrimitiveTypes.Enum;
    }

    if (typeContext === PrimitiveTypes.String) {
      return PrimitiveTypes.String;
    }

    if (uuidValidate(value)) {
      return PrimitiveTypes.Uuid;
    }

    if (
      !Number.isNaN(Number(value)) &&
      !Number.isNaN(parseFloat(value)) &&
      typeContext !== PrimitiveTypes.Number
    ) {
      // @see https://stackoverflow.com/questions/175739
      return PrimitiveTypes.Number;
    }

    const dateTime = DateTime.fromISO(value);

    if (dateTime.isValid) {
      return TypeGetter.getDateType(value, dateTime);
    }

    if (TypeGetter.isJson(value)) {
      return PrimitiveTypes.Json;
    }

    const potentialPoint = value.split(',');

    if (potentialPoint.length === 2 && typeContext === PrimitiveTypes.Point) {
      if (TypeGetter.get(potentialPoint) === ValidationTypes.ArrayOfNumber) {
        return PrimitiveTypes.Point;
      }
    }

    return PrimitiveTypes.String;
  }

  private static isJson(value: string): boolean {
    try {
      return !!JSON.parse(value);
    } catch {
      return false;
    }
  }
}
