import { ActionFieldType, File, Json } from '../../../interfaces/action';
import { CompositeId } from '../../../interfaces/record';

export type ValueOrHandler<Context = unknown, Result = unknown> =
  | ((context: Context) => Promise<Result>)
  | ((context: Context) => Result)
  | Result;

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
  extends BaseDynamicField<ActionFieldType.Collection, Context, CompositeId> {
  collectionName?: ValueOrHandler<Context, string>;
}

interface EnumDynamicField<Context>
  extends BaseDynamicField<ActionFieldType.Enum, Context, string> {
  enumValues: ValueOrHandler<Context, string[]>;
}

interface EnumListDynamicField<Context>
  extends BaseDynamicField<ActionFieldType.EnumList, Context, string[]> {
  enumValues: ValueOrHandler<Context, string[]>;
}

type BooleanDynamicField<Context> = BaseDynamicField<ActionFieldType.Boolean, Context, boolean>;
type FileDynamicField<Context> = BaseDynamicField<ActionFieldType.File, Context, File>;
type FileListDynamicField<Context> = BaseDynamicField<ActionFieldType.FileList, Context, File[]>;
type JsonDynamicField<Context> = BaseDynamicField<ActionFieldType.Json, Context, Json>;
type NumberDynamicField<Context> = BaseDynamicField<ActionFieldType.Number, Context, number>;

type NumberListDynamicField<Context> = BaseDynamicField<
  ActionFieldType.NumberList,
  Context,
  number[]
>;

type StringDynamicField<Context> = BaseDynamicField<
  ActionFieldType.Date | ActionFieldType.Dateonly | ActionFieldType.String,
  Context,
  string
>;

type StringListDynamicField<Context> = BaseDynamicField<
  ActionFieldType.StringList,
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
