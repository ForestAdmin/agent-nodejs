import { ActionScope } from '../../../interfaces/schema';
import { DynamicField } from './fields';
import ActionContext from '../context/base';
import ActionContextBulk from '../context/bulk';
import ActionContextSingle from '../context/single';
import ResponseBuilder from '../response-builder';

interface BaseAction {
  generateFile?: boolean;
}

export interface ActionGlobal extends BaseAction {
  scope: ActionScope.Global;
  form?: DynamicField<ActionContext>[];
  execute(context: ActionContext, responseBuilder: ResponseBuilder): Promise<void>;
}

export interface ActionBulk extends BaseAction {
  scope: ActionScope.Bulk;
  form?: DynamicField<ActionContextBulk>[];
  execute(context: ActionContextBulk, responseBuilder: ResponseBuilder): Promise<void>;
}

export interface ActionSingle extends BaseAction {
  scope: ActionScope.Single;
  form?: DynamicField<ActionContextSingle>[];
  execute(context: ActionContextSingle, responseBuilder: ResponseBuilder): Promise<void>;
}

export type Action = ActionSingle | ActionBulk | ActionGlobal;
