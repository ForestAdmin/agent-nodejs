import { HookAfterListContext, HookBeforeListContext } from './context/list';
import { TCollectionName, TSchema } from '../../interfaces/templates';
import HookContext from './context/hook';

export type HookHandler<
  T extends HookContext<S, N>,
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = (context: T) => Promise<void> | void;
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
  };
  after: {
    list: HookAfterListContext<S, N>;
  };
};
