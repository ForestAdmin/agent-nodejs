import { NonPrimitiveTypes, PrimitiveTypes } from '../interfaces/schema';

export default class TypeGetterUtil {
  private static readonly REGEX_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  static get(value: unknown): PrimitiveTypes | NonPrimitiveTypes | null {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return NonPrimitiveTypes.EmptyArray;
      }

      if (value.every(item => TypeGetterUtil.get(item) === PrimitiveTypes.Number)) {
        return NonPrimitiveTypes.ArrayOfNumber;
      }

      if (value.every(item => TypeGetterUtil.get(item) === PrimitiveTypes.String)) {
        return NonPrimitiveTypes.ArrayOfString;
      }

      if (value.every(item => TypeGetterUtil.get(item) === PrimitiveTypes.Boolean)) {
        return NonPrimitiveTypes.ArrayOfBoolean;
      }
    }

    if (typeof value === 'string') {
      if (value.match(TypeGetterUtil.REGEX_UUID)) {
        return PrimitiveTypes.Uuid;
      }

      if (!Number.isNaN(Number(value)) && !Number.isNaN(parseFloat(value))) {
        // @see https://stackoverflow.com/questions/175739
        return PrimitiveTypes.Number;
      }

      return PrimitiveTypes.String;
    }

    if (typeof value === 'number') {
      return PrimitiveTypes.Number;
    }

    if (typeof value === 'boolean') {
      return PrimitiveTypes.Boolean;
    }

    return null;
  }
}
