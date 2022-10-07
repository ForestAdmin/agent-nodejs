import { HookAfterAggregateContext, HookBeforeAggregateContext } from './context/aggregate';
import { HookAfterCreateContext, HookBeforeCreateContext } from './context/create';
import { HookAfterDeleteContext, HookBeforeDeleteContext } from './context/delete';
import { HookAfterListContext, HookBeforeListContext } from './context/list';
import { HookAfterUpdateContext, HookBeforeUpdateContext } from './context/update';
import { TCollectionName, TSchema } from '../../templates';
import HookContext from './context/hook';

export {
  HookContext,
  HookAfterAggregateContext,
  HookBeforeAggregateContext,
  HookAfterCreateContext,
  HookBeforeCreateContext,
  HookAfterDeleteContext,
  HookBeforeDeleteContext,
  HookAfterListContext,
  HookBeforeListContext,
  HookAfterUpdateContext,
  HookBeforeUpdateContext,
};

export type HookHandler<
  C extends HookContext<S, N>,
  R = void,
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = (context: C) => Promise<R> | R;

export type HookType<P extends HookPosition = HookPosition> = Extract<
  keyof HooksContext[P],
  string
>;

export type HookPosition = Extract<keyof HooksContext, string>;

export type HooksContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = {
  Before: {
    List: HookBeforeListContext<S, N>;
    Create: HookBeforeCreateContext<S, N>;
    Update: HookBeforeUpdateContext<S, N>;
    Delete: HookBeforeDeleteContext<S, N>;
    Aggregate: HookBeforeAggregateContext<S, N>;
  };
  After: {
    List: HookAfterListContext<S, N>;
    Create: HookAfterCreateContext<S, N>;
    Update: HookAfterUpdateContext<S, N>;
    Delete: HookAfterDeleteContext<S, N>;
    Aggregate: HookAfterAggregateContext<S, N>;
  };
};
