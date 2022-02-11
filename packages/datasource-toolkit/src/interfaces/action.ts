import { RecordData } from './record';
import Projection from './query/projection';

export interface Action {
  execute(formValues: RecordData, selection?: Selection): Promise<ActionResponse>;
  getForm(
    selection?: Selection,
    changedField?: string,
    formValues?: RecordData,
  ): Promise<ActionForm>;
}

export interface ActionForm {
  fields: ActionField[];
}

export interface ActionField {
  label: string;
  description?: string;
  type: ActionFieldType;
  enumValues: string[];
  isRequired?: boolean;
  isReadOnly?: boolean;
  defaultValue?: unknown;
  reloadOnChange: boolean;
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
  invalidatedDependencies?: Projection;
  options: {
    type: 'html' | 'text';
  };
};

export type ErrorResponse = SuccessReponse & { type: ActionResponseType.Error };

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
