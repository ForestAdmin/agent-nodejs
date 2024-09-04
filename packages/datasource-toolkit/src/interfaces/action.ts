import { Readable } from 'stream';

type UnionKeys<T> = T extends T ? keyof T : never;
type StrictUnionHelper<T, TAll> = T extends any
  ? T & Partial<Record<Exclude<UnionKeys<TAll>, keyof T>, never>>
  : never;
// This is a trick to disallow properties
// that are declared by other types in the union of different types
// Source: https://stackoverflow.com/a/65805753
type StrictUnion<T> = StrictUnionHelper<T, T>;

export type Json = string | number | boolean | { [x: string]: Json } | Array<Json>;
export type LimitedValuesOption<TValue> = { value: TValue; label: string } | TValue;

export type File = {
  mimeType: string;
  buffer: Buffer;
  name: string;
  charset?: string;
};

export type ActionFieldBase = {
  type: ActionFieldType;
  label: string;
  description?: string;
  isRequired?: boolean;
  isReadOnly?: boolean;
  value?: unknown;
  watchChanges: boolean;
};

export const ActionFieldTypeList = [
  'Boolean',
  'Collection',
  'Date',
  'Dateonly',
  'Time',
  'Enum',
  'File',
  'Json',
  'Number',
  'String',
  'EnumList',
  'FileList',
  'NumberList',
  'StringList',
] as const;

export type ActionFieldType = (typeof ActionFieldTypeList)[number];

type ActionFieldLimitedValue<
  TWidget extends string,
  TType extends ActionFieldType = ActionFieldType,
  TValue = unknown,
> = ActionFieldBase & {
  widget: TWidget;
  type: TType;
  options?: LimitedValuesOption<TValue>[];
};

export type ActionFieldDropdown<
  TType extends ActionFieldType = ActionFieldType,
  TValue = unknown,
> = ActionFieldBase &
  ActionFieldLimitedValue<'Dropdown', TType, TValue> & {
    search?: 'static' | 'disabled' | 'dynamic';
    placeholder?: string;
  };

export type ActionFieldCheckbox = ActionFieldBase & {
  type: 'Boolean';
  widget: 'Checkbox';
};

export type ActionFieldEnum = ActionFieldBase & {
  type: 'Enum';
  enumValues: string[];
};

export type ActionFieldEnumList = ActionFieldBase & {
  type: 'EnumList';
  enumValues: string[];
};

export type ActionFieldCollection = ActionFieldBase & {
  type: 'Collection';
  collectionName: string;
};

export type ActionFieldTextInput = ActionFieldBase & {
  type: 'String';
  widget: 'TextInput';
  placeholder?: string;
};

export type ActionFieldDatePickerInput = ActionFieldBase & {
  type: 'Date' | 'Dateonly' | 'String';
  widget: 'DatePicker';
  format?: string;
  min?: Date;
  max?: Date;
  placeholder?: string;
};

export type ActionFieldFilePicker = ActionFieldBase & {
  type: 'File' | 'FileList';
  widget: 'FilePicker';
  maxCount?: number;
  extensions?: string[];
  maxSizeMb?: number;
};

export type ActionFieldTextInputList = ActionFieldBase & {
  type: 'StringList';
  widget: 'TextInputList';
  placeholder?: string;
  enableReorder?: boolean;
  allowEmptyValues?: boolean;
  allowDuplicates?: boolean;
};

export type ActionFieldTextArea = ActionFieldBase & {
  type: 'String';
  widget: 'TextArea';
  placeholder?: string;
  rows?: number;
};

export type ActionFieldRichText = ActionFieldBase & {
  type: 'String';
  widget: 'RichText';
  placeholder?: string;
};

export type ActionFieldNumberInput = ActionFieldBase & {
  type: 'Number';
  widget: 'NumberInput';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
};

export type ActionFieldColorPicker = ActionFieldBase & {
  type: 'String';
  widget: 'ColorPicker';
  placeholder?: string;
  enableOpacity?: boolean;
  quickPalette?: string[];
};

export type ActionFieldNumberInputList = ActionFieldBase & {
  widget: 'NumberInputList';
  type: 'NumberList';
  placeholder?: string;
  enableReorder?: boolean;
  allowDuplicates?: boolean;
  min?: number;
  max?: number;
  step?: number;
};

export type ActionFieldCurrencyInput = ActionFieldBase & {
  type: 'Number';
  widget: 'CurrencyInput';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  currency: string;
  base?: 'Unit' | 'Cent';
};

export type ActionFieldUserDropdown = ActionFieldBase & {
  type: 'String';
  widget: 'UserDropdown';
  placeholder?: string;
};

export type ActionFieldTimePicker = ActionFieldBase & {
  type: 'Time';
  widget: 'TimePicker';
};

export type ActionFieldJsonEditor = ActionFieldBase & {
  type: 'Json';
  widget: 'JsonEditor';
};

export type ActionFieldAddressAutocomplete = ActionFieldBase & {
  type: 'String';
  widget: 'AddressAutocomplete';
  placeholder?: string;
};

export type ActionFieldDropdownAll =
  | ActionFieldDropdown<'Date' | 'Dateonly' | 'Number' | 'String' | 'StringList', string>
  | ActionFieldDropdown<'Number' | 'NumberList', number>;

export type ActionFieldRadioGroupButtonAll =
  | ActionFieldLimitedValue<'RadioGroup', 'Date' | 'Dateonly' | 'Number' | 'String', string>
  | ActionFieldLimitedValue<'RadioGroup', 'Number', number>;

export type ActionFieldCheckboxGroupAll =
  | ActionFieldLimitedValue<'CheckboxGroup', 'StringList', string>
  | ActionFieldLimitedValue<'CheckboxGroup', 'NumberList', number>;

type ActionLayoutElementPage = {
  type: 'Layout';
  widget: 'Page';
  nextButtonLabel: string;
  backButtonLabel: string;
  elements: ActionFieldOrLayoutElement[];
  watchChanges: boolean;
};

type ActionLayoutElementRow = {
  type: 'Layout';
  widget: 'Row';
  fields: [ActionField, ActionField];
  watchChanges: boolean;
};

type ActionLayoutElementSeparator = {
  type: 'Layout';
  widget: 'Separator';
  watchChanges: boolean;
};

type ActionLayoutElementLabel = {
  type: 'Layout';
  widget: 'Label';
  content: string;
  watchChanges: boolean;
};

type ActionLayoutElement =
  | ActionLayoutElementRow
  | ActionLayoutElementSeparator
  | ActionLayoutElementLabel;
export type ActionLayoutElementOrPage = ActionLayoutElement | ActionLayoutElementPage;

type ActionFieldOrLayoutElement = ActionField | ActionLayoutElement;

export type ActionInputField = StrictUnion<
  | ActionFieldBase
  | ActionFieldEnum
  | ActionFieldEnumList
  | ActionFieldCollection
  | ActionFieldDropdownAll
  | ActionFieldRadioGroupButtonAll
  | ActionFieldCheckboxGroupAll
  | ActionFieldCheckbox
  | ActionFieldTextInput
  | ActionFieldTextInputList
  | ActionFieldTextArea
  | ActionFieldRichText
  | ActionFieldNumberInput
  | ActionFieldColorPicker
  | ActionFieldNumberInputList
  | ActionFieldDatePickerInput
  | ActionFieldCurrencyInput
  | ActionFieldUserDropdown
  | ActionFieldTimePicker
  | ActionFieldJsonEditor
  | ActionFieldFilePicker
  | ActionFieldAddressAutocomplete
>;

export type ActionField = ActionInputField | ActionLayoutElementOrPage;

export type ActionFieldWidget =
  | 'Dropdown'
  | 'RadioGroup'
  | 'CheckboxGroup'
  | 'Checkbox'
  | 'TextInput'
  | 'TextInputList'
  | 'TextArea'
  | 'Timepicker'
  | 'RichText'
  | 'NumberInput'
  | 'NumberInputList'
  | 'ColorPicker'
  | 'DatePicker'
  | 'AddressAutocomplete'
  | 'UserDropdown'
  | 'TimePicker'
  | 'FilePicker'
  | 'JsonEditor';

export type SuccessResult = {
  type: 'Success';
  message: string;
  invalidated: Set<string>;
  html?: string;
};

export type ErrorResult = {
  type: 'Error';
  message: string;
  html?: string;
};

export type WebHookResult = {
  type: 'Webhook';
  url: string;
  method: 'GET' | 'POST';
  headers: { [key: string]: string };
  body: unknown;
};

export type FileResult = {
  type: 'File';
  mimeType: string;
  name: string;
  stream: Readable;
};

export type RedirectResult = {
  type: 'Redirect';
  path: string;
};

export type ActionHeaders = { [headerName: string]: string };

export type ActionResult = { responseHeaders?: ActionHeaders } & (
  | SuccessResult
  | ErrorResult
  | WebHookResult
  | FileResult
  | RedirectResult
);
