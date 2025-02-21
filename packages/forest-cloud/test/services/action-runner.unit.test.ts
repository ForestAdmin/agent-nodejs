import actionRunner from '../../src/dialogs/action-runner';
import { BusinessError } from '../../src/errors';
import { Spinner } from '../../src/types';

describe('actionRunner', () => {
  const setup = () => {
    const args = Symbol('args');
    const action = jest.fn();
    const spinner = {
      fail: jest.fn(),
      stop: jest.fn(),
    } as unknown as Spinner;

    return { action, args, spinner };
  };

  describe('when the action succeeds', () => {
    it('should return a function starting the spinner', async () => {
      const { action, args, spinner } = setup();

      await actionRunner(spinner, action)(args);

      expect(action).toHaveBeenCalled();
      expect(action).toHaveBeenCalledWith(args);
      expect(spinner.fail).not.toHaveBeenCalled();
      expect(spinner.stop).toHaveBeenCalled();
      // expect(process.exitCode).toBeUndefined();
    });
  });

  describe('when the action fails', () => {
    describe('when BusinessError is thrown', () => {
      it('should call fail on the spinner and process.exit(1)', async () => {
        const { action, args, spinner } = setup();
        const message = 'some business error occurred';
        action.mockRejectedValue(new BusinessError(message));

        await actionRunner(spinner, action)(args);

        expect(spinner.fail).toHaveBeenCalled();
        expect(spinner.fail).toHaveBeenCalledWith(message);
        expect(spinner.stop).toHaveBeenCalled();
        expect(process.exitCode).toEqual(1);
      });
    });

    describe('when a non BusinessError is thrown', () => {
      it('should let it throw', async () => {
        const { action, args, spinner } = setup();
        action.mockRejectedValue(new Error('some error occurred'));

        await expect(actionRunner(spinner, action)(args)).rejects.toEqual(
          new Error('some error occurred'),
        );

        expect(spinner.stop).toHaveBeenCalled();
        expect(spinner.fail).toHaveBeenCalledWith(
          'An unexpected error occurred.\nPlease reach out for help in our Developers community (https://community.forestadmin.com/)',
        );
      });
    });
  });
});
