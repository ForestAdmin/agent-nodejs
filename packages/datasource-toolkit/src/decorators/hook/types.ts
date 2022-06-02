import { HookAfterCreateContext, HookBeforeCreateContext } from './context/create';
import { HookAfterListContext, HookBeforeListContext } from './context/list';
import { TCollectionName, TSchema } from '../../interfaces/templates';
import HookContext from './context/hook';

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
  before: {
    list: HookBeforeListContext<S, N>;
    create: HookBeforeCreateContext<S, N>;
  };
  after: {
    list: HookAfterListContext<S, N>;
    create: HookAfterCreateContext<S, N>;
  };
};

export type HookDefinition<
  T,
  C extends HookContext<S, N>,
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = T | HookHandler<C, T>;
