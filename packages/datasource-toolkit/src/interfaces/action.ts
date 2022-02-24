import { RecordData } from './record';
import Filter from './query/filter/unpaginated';

export interface Action {
  execute(formValues: RecordData, filter?: Filter): Promise<ActionResult>;
  getForm(formValues: RecordData, filter?: Filter): Promise<ActionField[]>;
}

export interface ActionField {
  type: ActionFieldType;
  label: string;
  description?: string;
  isRequired?: boolean;
  isReadOnly?: boolean;
  value?: unknown;
  watchChanges: boolean;
  enumValues?: string[]; // When type === ActionFieldType.Enum
  collectionName?: string; // When type === ActionFieldType.Collection
}

export enum ActionFieldType {
  Boolean = 'Boolean',
  Collection = 'Collection',
  Date = 'Date',
  Dateonly = 'Dateonly',
  Enum = 'Enum',
  File = 'File',
  Json = 'Json',
  Number = 'Number',
  String = 'String',
  EnumList = 'Enum[]',
  FileList = 'File[]',
  NumberList = 'Number[]',
  StringList = 'String[]',
}

export enum ActionResultType {
  Success,
  Error,
  Webhook,
  File,
  Redirect,
}

export type SuccessResult = {
  type: ActionResultType.Success;
  message: string;
  format: 'html' | 'text';
  invalidated: Set<string>;
};

export type ErrorResult = {
  type: ActionResultType.Error;
  message: string;
};

export type WebHookResult = {
  type: ActionResultType.Webhook;
  url: string;
  method: 'GET' | 'POST';
  headers: { [key: string]: string };
  body: unknown;
};

export type FileResult = {
  type: ActionResultType.File;
  mimeType: string;
  name: string;
  stream: ReadableStream;
};

export type RedirectResult = {
  type: ActionResultType.Redirect;
  path: string;
};

export type ActionResult =
  | SuccessResult
  | ErrorResult
  | WebHookResult
  | FileResult
  | RedirectResult;
