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

export type ActionFormElementBase = {
  type: ActionFieldType | LayoutElementType;
};

export interface ActionFieldBase extends ActionFormElementBase {
  type: ActionFieldType;
  widget?: ActionFieldWidget;
  label: string;
  description?: string;
  isRequired?: boolean;
  isReadOnly?: boolean;
  value?: unknown;
  watchChanges: boolean;
}

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

export type ActionFieldType =
  | 'Boolean'
  | 'Collection'
  | 'Date'
  | 'Dateonly'
  | 'Time'
  | 'Enum'
  | 'File'
  | 'Json'
  | 'Number'
  | 'String'
  | 'EnumList'
  | 'FileList'
  | 'NumberList'
  | 'StringList';

export type LayoutElementType = 'Layout';

interface ActionFieldLimitedValue<
  TWidget extends ActionFieldWidget,
  TType extends ActionFieldType = ActionFieldType,
  TValue = unknown,
> extends ActionFieldBase {
  widget: TWidget;
  type: TType;
  options?: LimitedValuesOption<TValue>[];
}

export interface ActionFieldDropdown<
  TType extends ActionFieldType = ActionFieldType,
  TValue = unknown,
> extends ActionFieldLimitedValue<'Dropdown', TType, TValue> {
  search?: 'static' | 'disabled' | 'dynamic';
  placeholder?: string;
}

export interface ActionFieldCheckbox extends ActionFieldBase {
  type: 'Boolean';
  widget: 'Checkbox';
}

export interface ActionFieldEnum extends ActionFieldBase {
  type: 'Enum';
  enumValues: string[];
}

export interface ActionFieldEnumList extends ActionFieldBase {
  type: 'EnumList';
  enumValues: string[];
}

export interface ActionFieldCollection extends ActionFieldBase {
  type: 'Collection';
  collectionName: string;
}

export interface ActionFieldTextInput extends ActionFieldBase {
  type: 'String';
  widget: 'TextInput';
  placeholder?: string;
}

export interface ActionFieldDatePickerInput extends ActionFieldBase {
  type: 'Date' | 'Dateonly' | 'String';
  widget: 'DatePicker';
  format?: string;
  min?: Date;
  max?: Date;
  placeholder?: string;
}

export interface ActionFieldFilePicker extends ActionFieldBase {
  type: 'File' | 'FileList';
  widget: 'FilePicker';
  maxCount?: number;
  extensions?: string[];
  maxSizeMb?: number;
}

export interface ActionFieldTextInputList extends ActionFieldBase {
  type: 'StringList';
  widget: 'TextInputList';
  placeholder?: string;
  enableReorder?: boolean;
  allowEmptyValues?: boolean;
  allowDuplicates?: boolean;
}

export interface ActionFieldTextArea extends ActionFieldBase {
  type: 'String';
  widget: 'TextArea';
  placeholder?: string;
  rows?: number;
}

export interface ActionFieldRichText extends ActionFieldBase {
  type: 'String';
  widget: 'RichText';
  placeholder?: string;
}

export interface ActionFieldNumberInput extends ActionFieldBase {
  type: 'Number';
  widget: 'NumberInput';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface ActionFieldColorPicker extends ActionFieldBase {
  type: 'String';
  widget: 'ColorPicker';
  placeholder?: string;
  enableOpacity?: boolean;
  quickPalette?: string[];
}

export interface ActionFieldNumberInputList extends ActionFieldBase {
  widget: 'NumberInputList';
  type: 'NumberList';
  placeholder?: string;
  enableReorder?: boolean;
  allowDuplicates?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export interface ActionFieldCurrencyInput extends ActionFieldBase {
  type: 'Number';
  widget: 'CurrencyInput';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  currency: string;
  base?: 'Unit' | 'Cent';
}

export interface ActionFieldUserDropdown extends ActionFieldBase {
  type: 'String';
  widget: 'UserDropdown';
  placeholder?: string;
}

export interface ActionFieldTimePicker extends ActionFieldBase {
  type: 'Time';
  widget: 'TimePicker';
}

export interface ActionFieldJsonEditor extends ActionFieldBase {
  type: 'Json';
  widget: 'JsonEditor';
}

export interface ActionFieldAddressAutocomplete extends ActionFieldBase {
  type: 'String';
  widget: 'AddressAutocomplete';
  placeholder?: string;
}

export type ActionFieldDropdownAll =
  | ActionFieldDropdown<'Date' | 'Dateonly' | 'Number' | 'String' | 'StringList', string>
  | ActionFieldDropdown<'Number' | 'NumberList', number>;

export type ActionFieldRadioGroupButtonAll =
  | ActionFieldLimitedValue<'RadioGroup', 'Date' | 'Dateonly' | 'Number' | 'String', string>
  | ActionFieldLimitedValue<'RadioGroup', 'Number', number>;

export type ActionFieldCheckboxGroupAll =
  | ActionFieldLimitedValue<'CheckboxGroup', 'StringList', string>
  | ActionFieldLimitedValue<'CheckboxGroup', 'NumberList', number>;

export type ActionField = StrictUnion<
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
  | 'CurrencyInput'
  | 'ColorPicker'
  | 'DatePicker'
  | 'AddressAutocomplete'
  | 'UserDropdown'
  | 'TimePicker'
  | 'FilePicker'
  | 'JsonEditor';

interface ActionLayoutElementBase<T extends string> extends ActionFormElementBase {
  type: 'Layout';
  component: T;
}

type LayoutElementSeparator = ActionLayoutElementBase<'Separator'>;

interface LayoutElementHtmlBlock extends ActionLayoutElementBase<'HtmlBlock'> {
  content: string;
}

interface LayoutElementRow extends ActionLayoutElementBase<'Row'> {
  fields: LayoutElementInput[];
}

export interface LayoutElementInput extends ActionLayoutElementBase<'Input'> {
  fieldId: string;
}

export type ActionLayoutElement =
  | LayoutElementSeparator
  | LayoutElementHtmlBlock
  | LayoutElementRow
  | LayoutElementInput;

export type ActionFormElement = ActionLayoutElement | ActionField;

export type ActionForm = { fields: ActionField[]; layout: ActionLayoutElement[] };

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
