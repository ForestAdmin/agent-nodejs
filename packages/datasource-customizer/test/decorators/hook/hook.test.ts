import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import HookContext from '../../../src/decorators/hook/context/hook';
import Hooks from '../../../src/decorators/hook/hook';

class FakeHookContext extends HookContext {
  constructor() {
    super(factories.collection.build(), factories.caller.build());
  }
}

describe('Hooks', () => {
  describe('executeBefore', () => {
    describe('when multiple before hooks are defined', () => {
      test('it should call all of them', async () => {
        const firstHook = jest.fn();
        const secondHook = jest.fn();

        const hooks = new Hooks<FakeHookContext, FakeHookContext>();
        hooks.addHandler('Before', firstHook);
        hooks.addHandler('Before', secondHook);

        await hooks.executeBefore(new FakeHookContext());

        expect(firstHook).toHaveBeenCalledTimes(1);
        expect(secondHook).toHaveBeenCalledTimes(1);
      });

      test('it should call the second hook with the update context', async () => {
        const firstHook = jest.fn().mockImplementation(context => {
          context.aProps = 1;
        });
        const secondHook = jest.fn();

        const hooks = new Hooks<FakeHookContext, FakeHookContext>();
        hooks.addHandler('Before', firstHook);
        hooks.addHandler('Before', secondHook);

        const context = new FakeHookContext();
        await hooks.executeBefore(context);

        expect(secondHook).toHaveBeenCalledWith(expect.objectContaining({ aProps: 1 }));
      });

      describe('when the first hook raise an error', () => {
        test('it should prevent the second hook to run', async () => {
          const firstHook = jest.fn().mockImplementation(() => {
            throw Error();
          });
          const secondHook = jest.fn();

          const hooks = new Hooks<FakeHookContext, FakeHookContext>();
          hooks.addHandler('Before', firstHook);
          hooks.addHandler('Before', secondHook);

          const context = new FakeHookContext();
          await expect(() => hooks.executeBefore(context)).rejects.toThrow();
          expect(secondHook).not.toHaveBeenCalled();
        });
      });
    });

    describe('when after hook is defined', () => {
      test('it should not call the hook', async () => {
        const hook = jest.fn();

        const hooks = new Hooks<FakeHookContext, FakeHookContext>();
        hooks.addHandler('After', hook);

        const context = new FakeHookContext();
        await hooks.executeBefore(context);

        expect(hook).not.toHaveBeenCalled();
      });
    });
  });

  describe('executeAfter', () => {
    describe('when multiple after hooks are defined', () => {
      test('it should call all of them', async () => {
        const firstHook = jest.fn();
        const secondHook = jest.fn();

        const hooks = new Hooks<FakeHookContext, FakeHookContext>();
        hooks.addHandler('After', firstHook);
        hooks.addHandler('After', secondHook);

        await hooks.executeAfter(new FakeHookContext());

        expect(firstHook).toHaveBeenCalledTimes(1);
        expect(secondHook).toHaveBeenCalledTimes(1);
      });

      test('it should call the second hook with the update context', async () => {
        const firstHook = jest.fn().mockImplementation(context => {
          context.aProps = 1;
        });
        const secondHook = jest.fn();

        const hooks = new Hooks<FakeHookContext, FakeHookContext>();
        hooks.addHandler('After', firstHook);
        hooks.addHandler('After', secondHook);

        const context = new FakeHookContext();
        await hooks.executeAfter(context);

        expect(secondHook).toHaveBeenCalledWith(expect.objectContaining({ aProps: 1 }));
      });

      describe('when the first hook raise an error', () => {
        test('it should prevent the second hook to run', async () => {
          const firstHook = jest.fn().mockImplementation(() => {
            throw Error();
          });
          const secondHook = jest.fn();

          const hooks = new Hooks<FakeHookContext, FakeHookContext>();
          hooks.addHandler('After', firstHook);
          hooks.addHandler('After', secondHook);

          const context = new FakeHookContext();
          await expect(() => hooks.executeAfter(context)).rejects.toThrow();
          expect(secondHook).not.toHaveBeenCalled();
        });
      });
    });

    describe('when before hook is defined', () => {
      test('it should not call the hook', async () => {
        const hook = jest.fn();

        const hooks = new Hooks<FakeHookContext, FakeHookContext>();
        hooks.addHandler('Before', hook);

        const context = new FakeHookContext();
        await hooks.executeAfter(context);

        expect(hook).not.toHaveBeenCalled();
      });
    });
  });
});
