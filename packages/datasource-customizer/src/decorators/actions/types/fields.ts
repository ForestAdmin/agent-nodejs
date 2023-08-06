import { ActionFieldTypeEnum, CompositeId, Json } from '@forestadmin/datasource-toolkit';
import { z } from 'zod';

// const typesEnumSchema = z.enum([
//  Object.values(ActionFieldTypeEnum)[0],
//  ...Object.values(ActionFieldTypeEnum).slice(1),
// ]);

function valueOrHandlerSchema<
  HandlerArgType extends z.ZodTypeAny,
  ResultOrValueType extends z.ZodTypeAny,
>(returnTypeSchema: ResultOrValueType) {
  const valueOrPromiseSchema = returnTypeSchema.or(returnTypeSchema.promise());

  return valueOrPromiseSchema.or(
    z
      .function()
      .args(z.any() as unknown as HandlerArgType)
      .returns(valueOrPromiseSchema),
  );
}

function baseSchema<HandlerArgType extends z.ZodTypeAny, ResultOrValueType extends z.ZodTypeAny>(
  fieldValueType: ResultOrValueType,
) {
  return z.object({
    type: z.nativeEnum(ActionFieldTypeEnum),
    label: z.string().nonempty(),
    description: z.string().optional(),
    isRequired: valueOrHandlerSchema<HandlerArgType, z.ZodBoolean>(z.boolean()).optional(),
    isReadOnly: valueOrHandlerSchema<HandlerArgType, z.ZodBoolean>(z.boolean()).optional(),
    if: z
      .function()
      .args(z.any() as unknown as HandlerArgType)
      .returns(z.boolean())
      .or(
        z
          .function()
          .args(z.any() as unknown as HandlerArgType)
          .returns(z.boolean().promise()),
      )
      .optional(),
    value: valueOrHandlerSchema<HandlerArgType, ResultOrValueType>(fieldValueType).optional(),
    defaultValue: valueOrHandlerSchema<HandlerArgType, ResultOrValueType>(
      fieldValueType,
    ).optional(),
  });
}

function getSchemaCollection<C extends z.ZodTypeAny, R extends z.ZodTypeAny>() {
  return baseSchema<C, R>(z.any() as unknown as R).extend({
    collectionName: valueOrHandlerSchema<C, R>(z.string() as unknown as R),
    type: z.literal('Collection'),
  });
}

function getSchemaFile<C extends z.ZodTypeAny, R extends z.ZodTypeAny>() {
  return baseSchema<C, R>(z.any() as unknown as R).extend({
    type: z.literal('File'),
  });
}

function getSchemaFileList<C extends z.ZodTypeAny, R extends z.ZodTypeAny>() {
  return baseSchema<C, R>(z.any() as unknown as R).extend({
    type: z.literal('FileList'),
  });
}

function getSchemaJson<C extends z.ZodTypeAny, R extends z.ZodTypeAny>() {
  return baseSchema<C, R>(z.any() as unknown as R).extend({
    type: z.literal('Json'),
  });
}

function getSchemaBoolean<C extends z.ZodTypeAny>() {
  return baseSchema(z.boolean()).extend({
    type: z.literal('Boolean'),
  });
}

function getSchemaNumber<C extends z.ZodTypeAny, R extends z.ZodNumber>() {
  return baseSchema<C, R>(z.number() as R).extend({
    type: z.literal('Number'),
  });
}

function getSchemaNumberList<C extends z.ZodTypeAny>() {
  return baseSchema(z.number().array()).extend({
    type: z.literal('NumberList'),
  });
}

function getSchemaStringList<C extends z.ZodTypeAny>() {
  return baseSchema(z.string().array()).extend({
    type: z.literal('StringList'),
  });
}

function getSchemaStringDateOrDateOnly<C extends z.ZodTypeAny>() {
  return baseSchema(z.string()).extend({
    type: z.enum(['String', 'Date', 'Dateonly']),
  });
}

function getSchemaEnum<C extends z.ZodTypeAny, R extends z.ZodTypeAny>() {
  const valueOrPromiseSchema = z.string().array().or(z.string().array().promise());

  return baseSchema<C, R>(z.any() as unknown as R).extend({
    type: z.literal('Enum'),
    enumValues: valueOrPromiseSchema.or(
      z
        .function()
        .args(z.any() as unknown as C)
        .returns(valueOrPromiseSchema),
    ),
  });
}

function getSchemaEnumList<C extends z.ZodTypeAny, R extends z.ZodTypeAny>() {
  const valueOrPromiseSchema = z.string().array().or(z.string().array().promise());

  return baseSchema(z.string().array()).extend({
    type: z.literal('EnumList'),
    enumValues: valueOrPromiseSchema.or(
      z
        .function()
        .args(z.any() as unknown as C)
        .returns(valueOrPromiseSchema),
    ),
  });
}

export type DynamicField<C = unknown> =
  | z.infer<ReturnType<typeof getSchemaCollection<z.ZodSchema<C>, z.ZodSchema<CompositeId>>>>
  | z.infer<ReturnType<typeof getSchemaEnum<z.ZodSchema<C>, z.ZodString>>>
  | z.infer<ReturnType<typeof getSchemaEnumList<z.ZodSchema<C>, z.ZodArray<z.ZodString>>>>
  | z.infer<ReturnType<typeof getSchemaBoolean<z.ZodSchema<C>>>>
  | z.infer<ReturnType<typeof getSchemaFile<z.ZodSchema<C>, z.ZodSchema<File>>>>
  | z.infer<ReturnType<typeof getSchemaFileList<z.ZodSchema<C>, z.ZodArray<z.ZodSchema<File>>>>>
  | z.infer<ReturnType<typeof getSchemaJson<z.ZodSchema<C>, z.ZodSchema<Json>>>>
  | z.infer<ReturnType<typeof getSchemaNumber<z.ZodSchema<C>, z.ZodNumber>>>
  | z.infer<ReturnType<typeof getSchemaNumberList<z.ZodSchema<C>>>>
  | z.infer<ReturnType<typeof getSchemaStringList<z.ZodSchema<C>>>>
  | z.infer<ReturnType<typeof getSchemaStringDateOrDateOnly<z.ZodSchema<C>>>>;

export const fieldValidator: { [key in ActionFieldTypeEnum]: z.ZodSchema } = {
  [ActionFieldTypeEnum.Collection]: getSchemaCollection(),
  [ActionFieldTypeEnum.Boolean]: getSchemaBoolean(),
  [ActionFieldTypeEnum.Enum]: getSchemaEnum(),
  [ActionFieldTypeEnum.EnumList]: getSchemaEnumList(),
  [ActionFieldTypeEnum.File]: getSchemaFile(),
  [ActionFieldTypeEnum.FileList]: getSchemaFileList(),
  [ActionFieldTypeEnum.Json]: getSchemaJson(),
  [ActionFieldTypeEnum.Number]: getSchemaNumber(),
  [ActionFieldTypeEnum.NumberList]: getSchemaNumberList(),
  [ActionFieldTypeEnum.Date]: getSchemaStringDateOrDateOnly(),
  [ActionFieldTypeEnum.Dateonly]: getSchemaStringDateOrDateOnly(),
  [ActionFieldTypeEnum.String]: getSchemaStringDateOrDateOnly(),
  [ActionFieldTypeEnum.StringList]: getSchemaStringList(),
};
