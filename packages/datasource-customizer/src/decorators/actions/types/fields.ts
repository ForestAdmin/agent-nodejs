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

type LimitedValueDynamicFieldConfiguration<Context, TWidget, TValue = string> = {
  widget: TWidget;
  options: ValueOrHandler<Context, DropdownOption<TValue>[]>;
};

type DropdownDynamicFieldConfiguration<
  Context = unknown,
  TValue = string,
> = LimitedValueDynamicFieldConfiguration<Context, 'Dropdown', TValue> & {
  placeholder?: string;
  search?: 'static' | 'disabled';
};

type CheckboxDynamicFieldConfiguration = {
  widget: 'Checkbox';
};

type TextInputFieldConfiguration = {
  widget: 'TextInput';
  placeholder?: string;
};

type DateInputFieldConfiguration<Context> = {
  widget: 'DateTime';
  format?: ValueOrHandler<Context, string>;
  placeholder?: string;
  min?: ValueOrHandler<Context, Date>;
  max?: ValueOrHandler<Context, Date>;
};

type ArrayTextInputFieldConfiguration = {
  widget: 'TextInputList';
  placeholder?: string;
  enableReorder?: boolean;
  allowEmptyValues?: boolean;
  allowDuplicates?: boolean;
};

type ArrayNumberInputFieldConfiguration<Context> = {
  widget: 'NumberInputList';
  placeholder?: string;
  enableReorder?: boolean;
  allowDuplicates?: boolean;
  min?: ValueOrHandler<Context, number>;
  max?: ValueOrHandler<Context, number>;
  step?: ValueOrHandler<Context, number>;
};

type TextAreaFieldConfiguration = {
  widget: 'TextArea';
  placeholder?: string;
  rows?: number;
};

type RichTextFieldConfiguration = {
  widget: 'RichText';
  placeholder?: string;
};

type NumberInputFieldConfiguration<Context> = {
  widget: 'NumberInput';
  placeholder?: string;
  min?: ValueOrHandler<Context, number>;
  max?: ValueOrHandler<Context, number>;
  step?: ValueOrHandler<Context, number>;
};

type ColorPickerFieldConfiguration = {
  widget: 'ColorPicker';
  placeholder?: string;
  enableOpacity?: boolean;
  quickPalette?: string[];
};

type CurrencyInputFieldConfiguration<Context> = {
  widget: 'CurrencyInput';
  placeholder?: string;
  currency: ValueOrHandler<Context, string>;
  base?: ValueOrHandler<Context, 'Unit' | 'Cent'>;
  min?: ValueOrHandler<Context, number>;
  max?: ValueOrHandler<Context, number>;
  step?: ValueOrHandler<Context, number>;
};

type RadioButtonFieldConfiguration<
  Context = unknown,
  TValue = string,
> = LimitedValueDynamicFieldConfiguration<Context, 'RadioGroup', TValue>;

type CheckboxesFieldConfiguration<
  Context = unknown,
  TValue = string,
> = LimitedValueDynamicFieldConfiguration<Context, 'CheckboxGroup', TValue>;

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
  | (NumberDynamicField<Context> & NumberInputFieldConfiguration<Context>)
  | (NumberDynamicField<Context> & DropdownDynamicFieldConfiguration<Context, number>)
  | (NumberDynamicField<Context> & RadioButtonFieldConfiguration<Context, number>)
  | (NumberDynamicField<Context> & CurrencyInputFieldConfiguration<Context>)
  | NumberListDynamicField<Context>
  | (NumberListDynamicField<Context> & DropdownDynamicFieldConfiguration<Context, number>)
  | (NumberListDynamicField<Context> & CheckboxesFieldConfiguration<Context, number>)
  | (NumberListDynamicField<Context> & ArrayNumberInputFieldConfiguration<Context>)
  | StringDynamicField<Context>
  | (StringDynamicField<Context> & TextInputFieldConfiguration)
  | (StringDynamicField<Context> & DateInputFieldConfiguration<Context>)
  | (StringDynamicField<Context> & DropdownDynamicFieldConfiguration<Context, string>)
  | (StringDynamicField<Context> & RadioButtonFieldConfiguration<Context, string>)
  | (StringDynamicField<Context> & TextAreaFieldConfiguration)
  | (StringDynamicField<Context> & RichTextFieldConfiguration)
  | (StringDynamicField<Context> & ColorPickerFieldConfiguration)
  | StringListDynamicField<Context>
  | (StringListDynamicField<Context> & DropdownDynamicFieldConfiguration<Context, string>)
  | (StringListDynamicField<Context> & CheckboxesFieldConfiguration<Context, string>)
  | (StringListDynamicField<Context> & ArrayTextInputFieldConfiguration)
>;
