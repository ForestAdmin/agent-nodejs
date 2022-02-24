import { RecordData } from './record';
import Filter from './query/filter/unpaginated';

export interface Action {
  execute(formValues: RecordData, filter?: Filter): Promise<ActionResponse>;
  getForm(formValues: RecordData, filter?: Filter): Promise<ActionField[]>;
}

export interface ActionField {
  type: ActionFieldType;
  label: string;
  description?: string;
  enumValues?: string[];
  isRequired?: boolean;
  isReadOnly?: boolean;
  value?: unknown;
  collectionName?: string; // When type === ActionFieldType.Collection
  watchChanges: boolean;
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

export enum ActionResponseType {
  Success,
  Error,
  Webhook,
  File,
  Redirect,
}

export type SuccessReponse = {
  type: ActionResponseType.Success;
  message: string;
  format: 'html' | 'text';
  invalidated: Set<string>;
};

export type ErrorResponse = {
  type: ActionResponseType.Error;
  message: string;
};

export type WebHookReponse = {
  type: ActionResponseType.Webhook;
  url: string;
  method: 'GET' | 'POST';
  headers: { [key: string]: string };
  body: unknown;
};

export type FileResponse = {
  type: ActionResponseType.File;
  mimeType: string;
  name: string;
  stream: ReadableStream;
};

export type RedirectResponse = {
  type: ActionResponseType.Redirect;
  path: string;
};

export type ActionResponse =
  | SuccessReponse
  | ErrorResponse
  | WebHookReponse
  | FileResponse
  | RedirectResponse;
