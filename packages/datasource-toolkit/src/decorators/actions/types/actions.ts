import { ActionSchemaScope } from '../../../interfaces/schema';
import { DynamicField } from './fields';
import ActionContext from '../context/base';
import ActionContextBulk from '../context/bulk';
import ActionContextSingle from '../context/single';
import ResponseBuilder from '../response-builder';

export interface ActionGlobal {
  generateFile?: boolean;
  scope: ActionSchemaScope.Global;
  form?: DynamicField<ActionContext>[];

  execute(context: ActionContext, responseBuilder: ResponseBuilder): Promise<void>;
}

export interface ActionBulk {
  generateFile?: boolean;
  scope: ActionSchemaScope.Bulk;
  dependencies: string[];
  form?: DynamicField<ActionContextBulk>[];

  execute(context: ActionContextBulk, responseBuilder: ResponseBuilder): Promise<void>;
}

export interface ActionSingle {
  generateFile?: boolean;
  scope: ActionSchemaScope.Single;
  dependencies: string[];
  form?: DynamicField<ActionContextSingle>[];

  execute(context: ActionContextSingle, responseBuilder: ResponseBuilder): Promise<void>;
}

export type Action = ActionSingle | ActionBulk | ActionGlobal;
