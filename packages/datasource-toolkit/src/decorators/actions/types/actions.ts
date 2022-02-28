import { ActionResult } from '../../../interfaces/action';
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
  execute(
    context: ActionContext,
    responseBuilder: ResponseBuilder,
  ): void | ActionResult | Promise<void> | Promise<ActionResult>;
}

export interface ActionBulk extends BaseAction {
  scope: ActionScope.Bulk;
  form?: DynamicField<ActionContextBulk>[];
  execute(
    context: ActionContextBulk,
    responseBuilder: ResponseBuilder,
  ): void | ActionResult | Promise<void> | Promise<ActionResult>;
}

export interface ActionSingle extends BaseAction {
  scope: ActionScope.Single;
  form?: DynamicField<ActionContextSingle>[];
  execute(
    context: ActionContextSingle,
    responseBuilder: ResponseBuilder,
  ): void | ActionResult | Promise<void> | Promise<ActionResult>;
}

export type Action = ActionSingle | ActionBulk | ActionGlobal;
