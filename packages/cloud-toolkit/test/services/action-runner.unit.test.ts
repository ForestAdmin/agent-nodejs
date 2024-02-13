import { beforeEach } from 'node:test';
import ora from 'ora';

import actionRunner from '../../src/dialogs/action-runner';
import { BusinessError } from '../../src/errors';
import { Spinner } from '../../src/types';

jest.mock('ora');
const processExit = jest.spyOn(process, 'exit').mockImplementation();
beforeEach(() => {
  processExit.mockClear();
});

describe('actionRunner', () => {
  const setup = () => {
    const args = Symbol('args');
    const action = jest.fn();
    const spinner = {
      fail: jest.fn(),
      stop: jest.fn(),
    } as unknown as Spinner;

    (ora as unknown as jest.Mock).mockReturnValue(spinner);

    return { action, args, spinner };
  };

  describe('when the action succeeds', () => {
    it('should return a function starting the spinner', async () => {
      const { action, args, spinner } = setup();

      await actionRunner(() => spinner, action)(args);

      expect(action).toHaveBeenCalled();
      expect(action).toHaveBeenCalledWith(spinner, args);
      expect(spinner.fail).not.toHaveBeenCalled();
      expect(spinner.stop).toHaveBeenCalled();
    });
  });

  describe('when the action fails', () => {
    describe('when BusinessError is thrown', () => {
      it('should call fail on the spinner and process.exit(1)', async () => {
        const { action, args, spinner } = setup();
        const message = 'some business error occured';
        action.mockRejectedValue(new BusinessError(message));

        await actionRunner(() => spinner, action)(args);

        expect(spinner.fail).toHaveBeenCalled();
        expect(spinner.fail).toHaveBeenCalledWith(message);
        expect(spinner.stop).toHaveBeenCalled();
      });
    });

    describe('when a non BusinessError is thrown', () => {
      it('should let it throw', async () => {
        const { action, args, spinner } = setup();
        action.mockRejectedValue(new Error('some error occured'));

        await expect(actionRunner(() => spinner, action)(args)).rejects.toEqual(
          new Error('some error occured'),
        );

        expect(spinner.stop).toHaveBeenCalled();
        expect(spinner.fail).not.toHaveBeenCalled();
      });
    });
  });
});
