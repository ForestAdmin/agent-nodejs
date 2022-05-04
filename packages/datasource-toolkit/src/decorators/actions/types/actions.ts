import { ActionResult } from '../../../interfaces/action';
import { ActionScope } from '../../../interfaces/schema';
import { DynamicField } from './fields';
import ActionContext from '../context/base';
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

export type ActionGlobal = BaseAction<'Global', ActionContext>;
export type ActionBulk = BaseAction<'Bulk', ActionContext>;
export type ActionSingle = BaseAction<'Single', ActionContextSingle>;
export type Action = ActionSingle | ActionBulk | ActionGlobal;
