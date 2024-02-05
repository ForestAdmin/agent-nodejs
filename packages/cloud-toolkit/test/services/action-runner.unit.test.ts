import ora from 'ora';

import { BusinessError } from '../../src/errors';
import actionRunner from '../../src/services/action-runner';

jest.mock('ora');

describe('actionRunner', () => {
  const setup = () => {
    const args = Symbol('args');
    const action = jest.fn();
    const spinner = {
      fail: jest.fn(),
      stop: jest.fn(),
    };
    const oraLib = {
      start: () => spinner,
    };
    (ora as unknown as jest.Mock).mockReturnValue(oraLib);

    return { action, args, spinner };
  };

  describe('when the action succeeds', () => {
    it('should return a function starting the spinner', async () => {
      const { action, args, spinner } = setup();

      await actionRunner(action)(args);

      expect(action).toHaveBeenCalled();
      expect(action).toHaveBeenCalledWith(spinner, args);
      expect(spinner.fail).not.toHaveBeenCalled();
      expect(spinner.stop).toHaveBeenCalled();
    });
  });

  describe('when the action fails', () => {
    describe('when BusinessError is thrown', () => {
      it('should call fail on the spinner', async () => {
        const { action, args, spinner } = setup();
        const message = 'some business error occured';
        action.mockRejectedValue(new BusinessError(message));

        await actionRunner(action)(args);

        expect(spinner.fail).toHaveBeenCalled();
        expect(spinner.fail).toHaveBeenCalledWith(message);
        expect(spinner.stop).toHaveBeenCalled();
      });
    });

    describe('when a non BusinessError is thrown', () => {
      it('should let it throw', async () => {
        const { action, args, spinner } = setup();
        action.mockRejectedValue(new Error('some error occured'));

        await expect(actionRunner(action)(args)).rejects.toEqual(new Error('some error occured'));

        expect(spinner.stop).toHaveBeenCalled();
        expect(spinner.fail).not.toHaveBeenCalled();
      });
    });
  });
});
