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
export type DropdownOption<TValue> = { value: TValue; label: string } | TValue;

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

export type ActionFieldDropdown<
  TType extends ActionFieldType = ActionFieldType,
  TValue = unknown,
> = ActionFieldBase & {
  widget: 'Dropdown';
  type: TType;
  options?: DropdownOption<TValue>[];
  search?: 'static' | 'disabled';
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

export type ActionFieldTextInputList = ActionFieldBase & {
  type: 'StringList';
  widget: 'TextInputList';
  placeholder?: string;
  enableReorder?: boolean;
  allowEmptyValues?: boolean;
  allowDuplicates?: boolean;
};

export type ActionFieldDropdownAll =
  | ActionFieldDropdown<'Date' | 'Dateonly' | 'Number' | 'String' | 'StringList', string>
  | ActionFieldDropdown<'Number', number>;

export type ActionField = StrictUnion<
  | ActionFieldBase
  | ActionFieldEnum
  | ActionFieldEnumList
  | ActionFieldCollection
  | ActionFieldDropdownAll
  | ActionFieldCheckbox
  | ActionFieldTextInput
  | ActionFieldTextInputList
>;

export type ActionFieldWidget = 'Dropdown' | 'Checkbox' | 'TextInput' | 'TextInputList';

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

export type ActionResult =
  | SuccessResult
  | ErrorResult
  | WebHookResult
  | FileResult
  | RedirectResult;
