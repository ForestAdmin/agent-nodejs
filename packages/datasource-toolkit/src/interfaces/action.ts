import { Readable } from 'stream';

export type Json = string | number | boolean | { [x: string]: Json } | Array<Json>;

export type File = {
  mimeType: string;
  buffer: Buffer;
  name: string;
  charset?: string;
};

export interface ActionField {
  type: ActionFieldType;
  label: string;
  description?: string;
  isRequired?: boolean;
  isReadOnly?: boolean;
  value?: unknown;
  watchChanges: boolean;
  enumValues?: string[]; // When type === 'Enum'
  collectionName?: string; // When type === 'Collection'
}

export type ActionFieldType =
  | 'Boolean'
  | 'Collection'
  | 'Date'
  | 'Dateonly'
  | 'Enum'
  | 'File'
  | 'Json'
  | 'Number'
  | 'String'
  | 'EnumList'
  | 'FileList'
  | 'NumberList'
  | 'StringList';

export type SuccessResult = {
  type: 'Success';
  message: string;
  format: 'html' | 'text';
  invalidated: Set<string>;
};

export type ErrorResult = {
  type: 'Error';
  message: string;
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
