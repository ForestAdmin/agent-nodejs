import { ActionResult } from '../../../interfaces/action';
import { ActionScope } from '../../../interfaces/schema';
import { DynamicField } from './fields';
import { TCollectionName, TSchema } from '../../../interfaces/templates';
import ActionContext from '../context/base';
import ActionContextSingle from '../context/single';
import ResultBuilder from '../result-builder';

interface BaseAction<
  S extends TSchema,
  N extends TCollectionName<S>,
  Scope extends ActionScope,
  Context extends ActionContext<S, N>,
> {
  generateFile?: boolean;
  scope: Scope;
  form?: DynamicField<Context>[];
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

export type Action<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = ActionSingle<S, N> | ActionBulk<S, N> | ActionGlobal<S, N>;
