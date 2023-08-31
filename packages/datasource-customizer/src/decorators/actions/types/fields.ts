import { CompositeId, Json } from '@forestadmin/datasource-toolkit';

type UnionKeys<T> = T extends T ? keyof T : never;
type StrictUnionHelper<T, TAll> = T extends any
  ? T & Partial<Record<Exclude<UnionKeys<TAll>, keyof T>, never>>
  : never;
// This is a trick to disallow properties
// that are declared by other types in the union of different types
// Source: https://stackoverflow.com/a/65805753
type StrictUnion<T> = StrictUnionHelper<T, T>;

type DropdownOption<TValue = string> = { value: TValue | null; label: string } | TValue;

export type ValueOrHandler<Context = unknown, Result = unknown> =
  | ((context: Context) => Promise<Result>)
  | ((context: Context) => Result)
  | Promise<Result>
  | Result;

type BaseDynamicField<Type, Context, Result> = {
  type: Type;
  label: string;
  description?: string;
  isRequired?: ValueOrHandler<Context, boolean>;
  isReadOnly?: ValueOrHandler<Context, boolean>;
  if?: ((context: Context) => Promise<unknown>) | ((context: Context) => unknown);
  value?: ValueOrHandler<Context, Result>;
  defaultValue?: ValueOrHandler<Context, Result>;
};

type CollectionDynamicField<Context> = BaseDynamicField<'Collection', Context, CompositeId> & {
  collectionName: ValueOrHandler<Context, string>;
};

type EnumDynamicField<Context> = BaseDynamicField<'Enum', Context, string> & {
  enumValues: ValueOrHandler<Context, string[]>;
};

type EnumListDynamicField<Context> = BaseDynamicField<'EnumList', Context, string[]> & {
  enumValues: ValueOrHandler<Context, string[]>;
};

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

type DropdownDynamicFieldConfiguration<Context = unknown, TValue = string> = {
  widget: 'Dropdown';
  placeholder?: string;
  search?: 'static' | 'disabled';
  options: ValueOrHandler<Context, DropdownOption<TValue>[]>;
};

type CheckboxDynamicFieldConfiguration = {
  widget: 'Checkbox';
};

type TextInputFieldConfiguration = {
  widget: 'TextInput';
  placeholder?: string;
};

type ArrayInputFieldConfiguration = {
  widget: 'TextInputList';
  placeholder?: string;
  enableReorder?: boolean;
  allowEmptyValues?: boolean;
  allowDuplicates?: boolean;
};

export type DynamicField<Context = unknown> = StrictUnion<
  | BooleanDynamicField<Context>
  | (BooleanDynamicField<Context> & CheckboxDynamicFieldConfiguration)
  | CollectionDynamicField<Context>
  | EnumDynamicField<Context>
  | EnumListDynamicField<Context>
  | FileDynamicField<Context>
  | FileListDynamicField<Context>
  | JsonDynamicField<Context>
  | NumberDynamicField<Context>
  | (NumberDynamicField<Context> & DropdownDynamicFieldConfiguration<Context, number>)
  | (NumberListDynamicField<Context> & DropdownDynamicFieldConfiguration<Context, number>)
  | StringDynamicField<Context>
  | (StringDynamicField<Context> & TextInputFieldConfiguration)
  | (StringDynamicField<Context> & DropdownDynamicFieldConfiguration<string>)
  | StringListDynamicField<Context>
  | (StringListDynamicField<Context> & DropdownDynamicFieldConfiguration<string>)
  | (StringListDynamicField<Context> & ArrayInputFieldConfiguration)
>;
