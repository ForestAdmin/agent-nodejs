import { DateTime } from 'luxon';
import { PrimitiveTypes } from '../interfaces/schema';
import ValidationTypes from './types';

export default class TypeGetterUtil {
  private static readonly REGEX_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static get(
    value: unknown,
    typeContext?: PrimitiveTypes,
  ): PrimitiveTypes | ValidationTypes | null {
    if (Array.isArray(value)) {
      return TypeGetterUtil.getArrayType(value, typeContext);
    }

    if (typeof value === 'string') {
      return TypeGetterUtil.getTypeFromString(value, typeContext);
    }

    if (typeof value === 'number') {
      return PrimitiveTypes.Number;
    }

    if (typeof value === 'boolean') {
      return PrimitiveTypes.Boolean;
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

    if (value.length === 2 && typeContext === PrimitiveTypes.Point) {
      return PrimitiveTypes.Point;
    }

    if (value.every(item => TypeGetterUtil.get(item) === PrimitiveTypes.Number)) {
      return ValidationTypes.ArrayOfNumber;
    }

    if (value.every(item => TypeGetterUtil.get(item) === PrimitiveTypes.String)) {
      return ValidationTypes.ArrayOfString;
    }

    if (value.every(item => TypeGetterUtil.get(item) === PrimitiveTypes.Boolean)) {
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
    if (typeContext === PrimitiveTypes.String) {
      return PrimitiveTypes.String;
    }

    if (value.match(TypeGetterUtil.REGEX_UUID)) {
      return PrimitiveTypes.Uuid;
    }

    if (!Number.isNaN(Number(value)) && !Number.isNaN(parseFloat(value))) {
      // @see https://stackoverflow.com/questions/175739
      return PrimitiveTypes.Number;
    }

    const dateTime = DateTime.fromISO(value);

    if (dateTime.isValid) {
      return TypeGetterUtil.getDateType(value, dateTime);
    }

    if (TypeGetterUtil.isJson(value)) {
      return PrimitiveTypes.Json;
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
