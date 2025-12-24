import type { DynamicForm } from './fields';
import type { TCollectionName, TSchema } from '../../../templates';
import type ResultBuilder from '../result-builder';
import type { ActionResult, ActionScope } from '@forestadmin/datasource-toolkit';

import ActionContext from '../context/base';
import ActionContextSingle from '../context/single';

export { ActionContext, ActionContextSingle };

export interface BaseAction<
  S extends TSchema,
  N extends TCollectionName<S>,
  Scope extends ActionScope,
  Context extends ActionContext<S, N>,
> {
  generateFile?: boolean;
  scope: Scope;
  description?: string;
  submitButtonLabel?: string;
  form?:
    | DynamicForm<Context>
    | ((context: Context) => Promise<DynamicForm<Context>> | DynamicForm<Context>);
  execute(
    context: Context,
    resultBuilder: ResultBuilder,
  ): void | ActionResult | Promise<void> | Promise<ActionResult>;
}

export type ActionGlobal<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = BaseAction<S, N, 'Global', ActionContext<S, N>>;

export type ActionBulk<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = BaseAction<S, N, 'Bulk', ActionContext<S, N>>;

export type ActionSingle<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = BaseAction<S, N, 'Single', ActionContextSingle<S, N>>;

export type ActionDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = ActionSingle<S, N> | ActionBulk<S, N> | ActionGlobal<S, N>;
