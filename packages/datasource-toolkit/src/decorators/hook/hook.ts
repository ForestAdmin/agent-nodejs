import { DecoratorError } from '../../errors';
import { HookHandler, HookPosition } from './types';
import HookContext from './context/hook';
import HookFlow from './hook-flow';

export default class Hooks<B extends HookContext, A extends HookContext> {
  private before: HookHandler<B>[] = [];
  private after: HookHandler<A>[] = [];

  async executeBefore(context: B): Promise<B> {
    const flow = new HookFlow<B>(context);

    try {
      for (const hook of this.before) {
        // eslint-disable-next-line no-await-in-loop
        await hook(flow.continue(), flow);
      }

      return flow.continue();
    } catch (e) {
      throw new DecoratorError(e.message);
    }
  }

  async executeAfter(context: A): Promise<A> {
    const flow = new HookFlow<A>(context);

    try {
      for (const hook of this.after) {
        // eslint-disable-next-line no-await-in-loop
        await hook(flow.continue(), flow);
      }

      return flow.continue();
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
