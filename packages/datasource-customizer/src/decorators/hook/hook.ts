import type HookContext from './context/hook';
import type { HookHandler, HookPosition } from './types';

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

  // `prepend`: `execute{Before,After}` stops at the first exception, so a handler that must not be
  // preempted by another one throwing (e.g. the audit trail's after-hooks, which record a write
  // that already happened) can ask to run first instead of being appended.
  addHandler(position: HookPosition, handler: HookHandler<A> | HookHandler<B>, prepend = false) {
    if (position === 'After') {
      if (prepend) this.after.unshift(handler as HookHandler<A>);
      else this.after.push(handler as HookHandler<A>);
    } else if (prepend) {
      this.before.unshift(handler as HookHandler<B>);
    } else {
      this.before.push(handler as HookHandler<B>);
    }
  }
}
