import { ActionResult } from '../../../interfaces/action';
import { ActionScope } from '../../../interfaces/schema';
import { DynamicField } from './fields';
import ActionContext from '../context/base';
import ActionContextBulk from '../context/bulk';
import ActionContextSingle from '../context/single';
import ResultBuilder from '../result-builder';

interface BaseAction<Scope extends ActionScope, Context extends ActionContext> {
  generateFile?: boolean;
  scope: Scope;
  form?: DynamicField<Context>[];
  execute(
    context: Context,
    resultBuilder: ResultBuilder,
  ): void | ActionResult | Promise<void> | Promise<ActionResult>;
}

export type ActionGlobal = BaseAction<ActionScope.Global, ActionContext>;
export type ActionBulk = BaseAction<ActionScope.Bulk, ActionContextBulk>;
export type ActionSingle = BaseAction<ActionScope.Single, ActionContextSingle>;
export type Action = ActionSingle | ActionBulk | ActionGlobal;
