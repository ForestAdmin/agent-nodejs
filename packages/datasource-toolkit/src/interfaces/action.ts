import { Readable } from 'stream';

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
  TValue = string,
> = ActionFieldBase & {
  widget: 'Dropdown';
  type: TType;
  options?: DropdownOption<TValue>[];
  search?: 'static' | 'disabled';
  placeholder?: string;
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

export type ActionField =
  | ActionFieldBase
  | ActionFieldEnum
  | ActionFieldEnumList
  | ActionFieldCollection
  | ActionFieldDropdown<'Date' | 'Dateonly' | 'Number' | 'String', string>
  | ActionFieldDropdown<'Number', number>
  | ActionFieldTextInput;

export type ActionFieldWidget = 'Dropdown' | 'TextInput'; // Other widgets to be added in the future

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
