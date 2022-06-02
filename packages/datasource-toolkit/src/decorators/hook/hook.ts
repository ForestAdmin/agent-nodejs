import { DecoratorError } from '../../errors';
import { HookHandler, HookPosition } from './types';
import HookContext from './context/hook';

export default class Hooks<B extends HookContext, A extends HookContext> {
  private before: HookHandler<B>[] = [];
  private after: HookHandler<A>[] = [];

  async executeBefore(context: B): Promise<void> {
    try {
      for (const hook of this.before) {
        // eslint-disable-next-line no-await-in-loop
        await hook(context);
      }
    } catch (e) {
      throw new DecoratorError(e.message);
    }
  }

  async executeAfter(context: A): Promise<void> {
    try {
      for (const hook of this.after) {
        // eslint-disable-next-line no-await-in-loop
        await hook(context);
      }
    } catch (e) {
      throw new DecoratorError(e.message);
    }
  }

  addHandler(position: HookPosition, handler: HookHandler<A> | HookHandler<B>) {
    if (position === 'after') {
      this.after.push(handler as HookHandler<A>);
    } else {
      this.before.push(handler as HookHandler<B>);
    }
  }
}
