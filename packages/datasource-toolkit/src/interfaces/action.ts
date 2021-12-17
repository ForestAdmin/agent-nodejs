import { Projection } from "./query/projection";
import { RecordData } from "./query/record";

/**
 * Interface that Actions should implements
 */
export interface Action {
  /**
   * Function called when an Action is triggered
   * @params formValues
   * @params selection
   */
  execute(formValues: RecordData, selection?: Selection): Promise<ActionResponse>;
  /**
   * Function called to retrieve an action form
   * @params selection
   * @params changedField
   * @params formValues
   */
  getForm(
    selection?: Selection,
    changedField?: string,
    formValues?: RecordData
  ): Promise<ActionForm>;
}

/**
 * Represent an action form
 */
export interface ActionForm {
  fields: ActionField[];
}

/**
 * Represent an action field
 */
export interface ActionField {
  field: string;
  description?: string;
  type: ActionFieldType;
  isRequired?: boolean;
  isReadOnly?: boolean;
  defaultValue?: unknown;
  useChangeHook: boolean;

  enums?: unknown[]; // When type === ActionFieldType.Enum
  collectionName?: string; // When type === ActionFieldType.Collection
}

/** Enumeration of supported action field types */
export enum ActionFieldType {
  Boolean = "Boolean",
  Collection = "Collection",
  Date = "Date",
  Dateonly = "Dateonly",
  Enum = "Enum",
  File = "File",
  Number = "Number",
  String = "String",
  Json = "Json",
  EnumList = "Enum[]",
  NumberList = "Number[]",
  StringList = "String[]",
}

/** Enumeration of supported action response types */
export enum ActionResponseType {
  Success,
  Error,
  Webhook,
  File,
  Redirect,
}

/**
 * Represent a success action response
 *
 * It will trigger a green/success toastr when calling the action
 */
export type SuccessReponse = {
  type: ActionResponseType.Success;
  message: string;
  invalidatedDependencies: Projection;
  options: {
    type: "html" | "text";
  };
};

/**
 * Represent an error action response
 *
 * It will trigger a red/danger toastr when calling the action
 */
export type ErrorResponse = SuccessReponse & { type: ActionResponseType.Error };

/** Represent an action response of type webhook */
export type WebHookReponse = {
  type: ActionResponseType.Webhook;
  /** URL of the webhook */
  url: string;
  /** Method used to call the webhook */
  method: "GET" | "POST";
  /** A set of headers to happen to the webhook */
  headers: { [key: string]: string };
  /** The body to use when calling the webhook */
  body: unknown;
};

/** Represent an action response of type file */
export type FileResponse = {
  type: ActionResponseType.File;
  /** Mime type of the response */
  mimeType: string;
  /** A stream of the file to respond */
  stream: ReadableStream;
};

/** Represent an action response of type redirection */
export type RedirectResponse = {
  type: ActionResponseType.Redirect;
  /** Path to redirect to */
  path: string;
};

/** Represent the type of action response */
export type ActionResponse =
  | SuccessReponse
  | ErrorResponse
  | WebHookReponse
  | FileResponse
  | RedirectResponse;
