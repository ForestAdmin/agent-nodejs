import { CompositeId } from '../../../interfaces/record';
import { File, Json } from '../../../interfaces/action';

export type ValueOrHandler<Context = unknown, Result = unknown> =
  | ((context: Context) => Promise<Result>)
  | ((context: Context) => Result)
  | Promise<Result>
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
  extends BaseDynamicField<'Collection', Context, CompositeId> {
  collectionName: ValueOrHandler<Context, string>;
}

interface EnumDynamicField<Context> extends BaseDynamicField<'Enum', Context, string> {
  enumValues: ValueOrHandler<Context, string[]>;
}

interface EnumListDynamicField<Context> extends BaseDynamicField<'EnumList', Context, string[]> {
  enumValues: ValueOrHandler<Context, string[]>;
}

type BooleanDynamicField<Context> = BaseDynamicField<'Boolean', Context, boolean>;
type FileDynamicField<Context> = BaseDynamicField<'File', Context, File>;
type FileListDynamicField<Context> = BaseDynamicField<'FileList', Context, File[]>;
type JsonDynamicField<Context> = BaseDynamicField<'Json', Context, Json>;
type NumberDynamicField<Context> = BaseDynamicField<'Number', Context, number>;

type NumberListDynamicField<Context> = BaseDynamicField<'NumberList', Context, number[]>;

type StringDynamicField<Context> = BaseDynamicField<
  'Date' | 'Dateonly' | 'String',
  Context,
  string
>;

type StringListDynamicField<Context> = BaseDynamicField<'StringList', Context, string[]>;

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
