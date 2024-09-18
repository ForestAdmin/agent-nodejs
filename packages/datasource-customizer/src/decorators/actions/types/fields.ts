import { CompositeId, File, Json } from '@forestadmin/datasource-toolkit';

type UnionKeys<T> = T extends T ? keyof T : never;
type StrictUnionHelper<T, TAll> = T extends any
  ? T & Partial<Record<Exclude<UnionKeys<TAll>, keyof T>, never>>
  : never;
// This is a trick to disallow properties
// that are declared by other types in the union of different types
// Source: https://stackoverflow.com/a/65805753
type StrictUnion<T> = StrictUnionHelper<T, T>;

export type DropdownOption<TValue = string> = { value: TValue | null; label: string } | TValue;

export type Handler<Context = unknown, Result = unknown> =
  | ((context: Context) => Promise<Result>)
  | ((context: Context) => Result);

export type ValueOrHandler<Context = unknown, Result = unknown> =
  | Handler<Context, Result>
  | Promise<Result>
  | Result;

type BaseDynamicField<Type, Context, Result> = {
  type: Type;
  id?: string;
  label: string;
  description?: ValueOrHandler<Context, string>;
  isRequired?: ValueOrHandler<Context, boolean>;
  isReadOnly?: ValueOrHandler<Context, boolean>;
  if?: Handler<Context, unknown>;
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
type TimeDynamicField<Context> = BaseDynamicField<'Time', Context, number> & {
  widget: 'TimePicker';
};
type NumberListDynamicField<Context> = BaseDynamicField<'NumberList', Context, number[]>;
type DateDynamicField<Context> = BaseDynamicField<'Date' | 'Dateonly', Context, Date>;

type StringDynamicField<Context> = BaseDynamicField<
  'String' | 'Date' | 'Dateonly',
  Context,
  string
>;

type StringListDynamicField<Context> = BaseDynamicField<'StringList', Context, string[]>;

export type SearchOptionsHandler<Context = unknown, TValue = string> =
  | ((context: Context, searchValue: string) => DropdownOption<TValue>[])
  | ((context: Context, searchValue: string) => Promise<DropdownOption<TValue>[]>);

type LimitedValueDynamicFieldConfiguration<Context, TWidget, TValue = string> = {
  widget: TWidget;
  options:
    | DropdownOption<TValue>[]
    | Promise<DropdownOption<TValue>[]>
    // The searchOptionsHandle is not 100% accurate
    // with all the widget that are extending this type.
    // But we have an issue with the context argument that is not correctly typed if we
    // use a stricter definition for this property.
    | SearchOptionsHandler<Context, TValue>;
};

type DropdownDynamicFieldConfiguration<
  Context = unknown,
  TValue = string,
> = LimitedValueDynamicFieldConfiguration<Context, 'Dropdown', TValue> & {
  placeholder?: string;
  search?: 'static' | 'disabled';
};

type DropdownDynamicSearchFieldConfiguration<Context = unknown, TValue = string> = {
  widget: 'Dropdown';
  options: SearchOptionsHandler<Context, TValue>;
  placeholder?: string;
  search: 'dynamic';
};

type CheckboxDynamicFieldConfiguration = {
  widget: 'Checkbox';
};

type TextInputFieldConfiguration = {
  widget: 'TextInput';
  placeholder?: string;
};

type DatePickerInputFieldConfiguration<Context> = {
  widget: 'DatePicker';
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

type UserDropdownFieldConfiguration = {
  widget: 'UserDropdown';
  placeholder?: string;
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

type JsonEditorFieldConfiguration = {
  widget: 'JsonEditor';
};

type FileListPickerFieldConfiguration = FilePickerFieldConfiguration & {
  maxCount?: ValueOrHandler<number>;
};

type FilePickerFieldConfiguration = {
  widget: 'FilePicker';
  extensions?: ValueOrHandler<string[]>;
  maxSizeMb?: ValueOrHandler<number>;
};

type AddressAutocompleteFieldConfiguration = {
  widget: 'AddressAutocomplete';
  placeholder?: string;
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
  | (JsonDynamicField<Context> & JsonEditorFieldConfiguration)
  | NumberDynamicField<Context>
  | TimeDynamicField<Context>
  | (NumberDynamicField<Context> & NumberInputFieldConfiguration<Context>)
  | (NumberDynamicField<Context> & DropdownDynamicFieldConfiguration<Context, number>)
  | (NumberDynamicField<Context> & DropdownDynamicSearchFieldConfiguration<Context, number>)
  | (NumberDynamicField<Context> & RadioButtonFieldConfiguration<Context, number>)
  | (NumberDynamicField<Context> & CurrencyInputFieldConfiguration<Context>)
  | NumberListDynamicField<Context>
  | (NumberListDynamicField<Context> & DropdownDynamicFieldConfiguration<Context, number>)
  | (NumberListDynamicField<Context> & DropdownDynamicSearchFieldConfiguration<Context, number>)
  | (NumberListDynamicField<Context> & CheckboxesFieldConfiguration<Context, number>)
  | (NumberListDynamicField<Context> & ArrayNumberInputFieldConfiguration<Context>)
  | StringDynamicField<Context>
  | (DateDynamicField<Context> & DatePickerInputFieldConfiguration<Context>)
  | (StringDynamicField<Context> & TextInputFieldConfiguration)
  | (StringDynamicField<Context> & DropdownDynamicFieldConfiguration<Context, string>)
  | (StringDynamicField<Context> & DropdownDynamicSearchFieldConfiguration<Context, string>)
  | (StringDynamicField<Context> & RadioButtonFieldConfiguration<Context, string>)
  | (StringDynamicField<Context> & TextAreaFieldConfiguration)
  | (StringDynamicField<Context> & RichTextFieldConfiguration)
  | (StringDynamicField<Context> & ColorPickerFieldConfiguration)
  | (StringDynamicField<Context> & AddressAutocompleteFieldConfiguration)
  | (StringDynamicField<Context> & UserDropdownFieldConfiguration)
  | (FileDynamicField<Context> & FilePickerFieldConfiguration)
  | StringListDynamicField<Context>
  | (StringListDynamicField<Context> & DropdownDynamicFieldConfiguration<Context, string>)
  | (StringListDynamicField<Context> & DropdownDynamicSearchFieldConfiguration<Context, string>)
  | (StringListDynamicField<Context> & CheckboxesFieldConfiguration<Context, string>)
  | (StringListDynamicField<Context> & ArrayTextInputFieldConfiguration)
  | (StringListDynamicField<Context> & UserDropdownFieldConfiguration)
  | (FileListDynamicField<Context> & FileListPickerFieldConfiguration)
>;

type DynamicLayoutElementBase<Context> = {
  type: 'Layout';
  if?: Handler<Context, unknown>;
};

type DynamicLayoutElementSeparator<Context> = DynamicLayoutElementBase<Context> & {
  component: 'Separator';
};

type DynamicLayoutElementHtmlBlock<Context> = DynamicLayoutElementBase<Context> & {
  component: 'HtmlBlock';
  content: ValueOrHandler<Context, string>;
};

type DynamicLayoutElementRow<Context> = DynamicLayoutElementBase<Context> & {
  component: 'Row';
  fields: DynamicField<Context>[];
};

export type DynamicLayoutElement<Context = unknown> =
  | DynamicLayoutElementSeparator<Context>
  | DynamicLayoutElementRow<Context>
  | DynamicLayoutElementHtmlBlock<Context>;

export type DynamicFormElement<Context = unknown> =
  | DynamicField<Context>
  | DynamicLayoutElement<Context>;

export type DynamicFieldWithId<Context = unknown> = DynamicField<Context> & { id: string };

export type DynamicFormElementWithId<Context = unknown> =
  | DynamicFieldWithId<Context>
  | DynamicLayoutElement<Context>;
