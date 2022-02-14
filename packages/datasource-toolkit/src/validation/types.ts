export enum ValidationTypesArray {
  Boolean = 'ArrayOfBoolean',
  Enum = 'ArrayOfEnum',
  Number = 'ArrayOfNumber',
  String = 'ArrayOfString',
  Uuid = 'ArrayOfUuid',
  Empty = 'EmptyArray',
}

export enum ValidationPrimaryTypes {
  Null = 'Null',
}

type ValidationTypes = ValidationTypesArray | ValidationPrimaryTypes;

export default ValidationTypes;
