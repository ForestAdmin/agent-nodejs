import HookContext from './context/hook';
import { HookHandler, HookPosition } from './types';

export default class Hooks<B extends HookContext, A extends HookContext> {
  private before: HookHandler<B>[] = [];
  private after: HookHandler<A>[] = [];

  async executeBefore(context: B): Promise<void> {
    for (const hook of this.before) {
      // eslint-disable-next-line no-await-in-loop
      await hook(context);
    }
  }

  async executeAfter(context: A): Promise<void> {
    for (const hook of this.after) {
      // eslint-disable-next-line no-await-in-loop
      await hook(context);
    }
  }

  addHandler(position: HookPosition, handler: HookHandler<A> | HookHandler<B>) {
    if (position === 'After') {
      this.after.push(handler as HookHandler<A>);
    } else {
      this.before.push(handler as HookHandler<B>);
    }
  }
}
