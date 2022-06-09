import * as factories from '../../__factories__';
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

        const hookhooks = new Hooks<FakeHookContext, FakeHookContext>();
        hookhooks.addHandler('Before', firstHook);
        hookhooks.addHandler('Before', secondHook);

        await hookhooks.executeBefore(new FakeHookContext());

        expect(firstHook).toHaveBeenCalledTimes(1);
        expect(secondHook).toHaveBeenCalledTimes(1);
      });

      test('it should call the second hook with the update context', async () => {
        const firstHook = jest.fn().mockImplementation(context => {
          context.aProps = 1;
        });
        const secondHook = jest.fn();

        const hookhooks = new Hooks<FakeHookContext, FakeHookContext>();
        hookhooks.addHandler('Before', firstHook);
        hookhooks.addHandler('Before', secondHook);

        const context = new FakeHookContext();
        await hookhooks.executeBefore(context);

        expect(secondHook).toHaveBeenCalledWith(expect.objectContaining({ aProps: 1 }));
      });

      describe('when the first hook raise an error', () => {
        test('it should prevent the second hook to run', async () => {
          const firstHook = jest.fn().mockImplementation(() => {
            throw Error();
          });
          const secondHook = jest.fn();

          const hookhooks = new Hooks<FakeHookContext, FakeHookContext>();
          hookhooks.addHandler('Before', firstHook);
          hookhooks.addHandler('Before', secondHook);

          const context = new FakeHookContext();
          await expect(() => hookhooks.executeBefore(context)).rejects.toThrow();
          expect(secondHook).not.toHaveBeenCalled();
        });
      });
    });

    describe('when after hook is defined', () => {
      test('it should not call the hook', async () => {
        const hook = jest.fn();

        const hookhooks = new Hooks<FakeHookContext, FakeHookContext>();
        hookhooks.addHandler('After', hook);

        const context = new FakeHookContext();
        await hookhooks.executeBefore(context);

        expect(hook).not.toHaveBeenCalled();
      });
    });
  });

  describe('executeAfter', () => {
    describe('when multiple after hooks are defined', () => {
      test('it should call all of them', async () => {
        const firstHook = jest.fn();
        const secondHook = jest.fn();

        const hookhooks = new Hooks<FakeHookContext, FakeHookContext>();
        hookhooks.addHandler('After', firstHook);
        hookhooks.addHandler('After', secondHook);

        await hookhooks.executeAfter(new FakeHookContext());

        expect(firstHook).toHaveBeenCalledTimes(1);
        expect(secondHook).toHaveBeenCalledTimes(1);
      });

      test('it should call the second hook with the update context', async () => {
        const firstHook = jest.fn().mockImplementation(context => {
          context.aProps = 1;
        });
        const secondHook = jest.fn();

        const hookhooks = new Hooks<FakeHookContext, FakeHookContext>();
        hookhooks.addHandler('After', firstHook);
        hookhooks.addHandler('After', secondHook);

        const context = new FakeHookContext();
        await hookhooks.executeAfter(context);

        expect(secondHook).toHaveBeenCalledWith(expect.objectContaining({ aProps: 1 }));
      });

      describe('when the first hook raise an error', () => {
        test('it should prevent the second hook to run', async () => {
          const firstHook = jest.fn().mockImplementation(() => {
            throw Error();
          });
          const secondHook = jest.fn();

          const hookhooks = new Hooks<FakeHookContext, FakeHookContext>();
          hookhooks.addHandler('After', firstHook);
          hookhooks.addHandler('After', secondHook);

          const context = new FakeHookContext();
          await expect(() => hookhooks.executeAfter(context)).rejects.toThrow();
          expect(secondHook).not.toHaveBeenCalled();
        });
      });
    });

    describe('when before hook is defined', () => {
      test('it should not call the hook', async () => {
        const hook = jest.fn();

        const hookhooks = new Hooks<FakeHookContext, FakeHookContext>();
        hookhooks.addHandler('Before', hook);

        const context = new FakeHookContext();
        await hookhooks.executeAfter(context);

        expect(hook).not.toHaveBeenCalled();
      });
    });
  });
});
