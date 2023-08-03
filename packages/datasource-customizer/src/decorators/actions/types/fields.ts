/* eslint-disable @typescript-eslint/dot-notation */
import {
  ActionFieldType,
  ActionFieldTypeEnum,
  CompositeId,
  Json,
} from '@forestadmin/datasource-toolkit';

/**
 * This function generates an AJV-compatible validator schema for an object that is either
 * a string or a boolean (depending on the type passed)
 * any function
 * this is used to validate field properties like `isRequired` or `collectionName`
 * NOTICE: it would be nice to validate the return type of the function as well to match the passed
 * but it is not possible in AJV
 */
const valueOrHandlerSchema = (type: 'boolean' | 'string') => {
  return {
    anyOf: [{ type }, { typeof: 'function' }],
    errorMessage: `should either be a ${type} or a function`,
  };
};

export type ValueOrHandler<Context = unknown, Result = unknown> =
  | ((context: Context) => Promise<Result>)
  | ((context: Context) => Result)
  | Promise<Result>
  | Result;

export const fieldActionSchema = (type: ActionFieldType) => {
  const schema = {
    type: 'object',
    properties: {
      type: { type: 'string', enum: Object.values(ActionFieldTypeEnum) },
      label: { type: 'string' },
      description: { type: 'string' },
      isRequired: valueOrHandlerSchema('boolean'),
      isReadOnly: valueOrHandlerSchema('boolean'),
      if: valueOrHandlerSchema('boolean'),
      value: {},
      defaultValue: {},
    },
    required: ['label', 'type'],
    additionalProperties: false,
  };

  switch (type) {
    case ActionFieldTypeEnum.Collection:
      schema.properties['collectionName'] = valueOrHandlerSchema('string');
      schema.required.push('collectionName');

      break;
    case ActionFieldTypeEnum.Enum:
    case ActionFieldTypeEnum.EnumList:
      schema.properties['enumValues'] = {
        anyOf: [
          { type: 'array', items: { type: ['string'] } },
          {
            typeof: 'function',
          },
        ],
        errorMessage: 'should either be an array of string or a function',
      };
      schema.required.push('enumValues');

      break;

    default:
      break;
  }

  return schema;
};

interface BaseDynamicField<Type, Context, Result> {
  type: Type;
  label: string;
  description?: string;
  isRequired?: ValueOrHandler<Context, boolean>;
  isReadOnly?: ValueOrHandler<Context, boolean>;

  if?: ((context: Context) => Promise<unknown>) | ((context: Context) => unknown);
  value?: ValueOrHandler<Context, Result>;
  defaultValue?: ValueOrHandler<Context, Result>;
}

interface CollectionDynamicField<Context>
  extends BaseDynamicField<`${ActionFieldTypeEnum.Collection}`, Context, CompositeId> {
  collectionName: ValueOrHandler<Context, string>;
}

interface EnumDynamicField<Context>
  extends BaseDynamicField<`${ActionFieldTypeEnum.Enum}`, Context, string> {
  enumValues: ValueOrHandler<Context, string[]>;
}

interface EnumListDynamicField<Context>
  extends BaseDynamicField<`${ActionFieldTypeEnum.EnumList}`, Context, string[]> {
  enumValues: ValueOrHandler<Context, string[]>;
}

export type BooleanDynamicField<Context> = BaseDynamicField<
  `${ActionFieldTypeEnum.Boolean}`,
  Context,
  boolean
>;
type FileDynamicField<Context> = BaseDynamicField<`${ActionFieldTypeEnum.File}`, Context, File>;
type FileListDynamicField<Context> = BaseDynamicField<
  `${ActionFieldTypeEnum.FileList}`,
  Context,
  File[]
>;
type JsonDynamicField<Context> = BaseDynamicField<`${ActionFieldTypeEnum.Json}`, Context, Json>;
type NumberDynamicField<Context> = BaseDynamicField<
  `${ActionFieldTypeEnum.Number}`,
  Context,
  number
>;

type NumberListDynamicField<Context> = BaseDynamicField<
  `${ActionFieldTypeEnum.NumberList}`,
  Context,
  number[]
>;

type StringDynamicField<Context> = BaseDynamicField<
  | `${ActionFieldTypeEnum.Date}`
  | `${ActionFieldTypeEnum.Dateonly}`
  | `${ActionFieldTypeEnum.String}`,
  Context,
  string
>;

type StringListDynamicField<Context> = BaseDynamicField<
  `${ActionFieldTypeEnum.StringList}`,
  Context,
  string[]
>;

export type DynamicField<Context = unknown> =
  | BooleanDynamicField<Context>
  | CollectionDynamicField<Context>
  | EnumDynamicField<Context>
  | EnumListDynamicField<Context>
  | FileDynamicField<Context>
  | FileListDynamicField<Context>
  | JsonDynamicField<Context>
  | NumberDynamicField<Context>
  | NumberListDynamicField<Context>
  | StringDynamicField<Context>
  | StringListDynamicField<Context>;
