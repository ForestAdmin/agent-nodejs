import CommandTester from './command-tester';
import makeCommands from '../../src/make-commands';
import { MakeCommands } from '../../src/types';

describe('bootstrap command', () => {
  const setupCommandArguments = (
    options: Partial<{
      getLastPublishedCodeDetails: jest.Mock;
    }> = {},
  ): jest.Mocked<MakeCommands> => {
    const getOrRefreshEnvironmentVariables = jest.fn();
    const getEnvironmentVariables = jest.fn();
    const buildHttpForestServer = jest.fn().mockReturnValue({
      getIntrospection: jest.fn(),
      postUploadRequest: jest.fn(),
      getLastPublishedCodeDetails: options.getLastPublishedCodeDetails || jest.fn(),
      postPublish: jest.fn(),
    });
    const buildEventSubscriber = jest.fn();

    return {
      getOrRefreshEnvironmentVariables,
      getEnvironmentVariables,
      buildHttpForestServer,
      buildEventSubscriber,
    };
  };

  describe('when the project has already customization code', () => {
    it('should ask to the customer if he wants to bootstrap again', async () => {
      const getLastPublishedCodeDetails = jest.fn().mockResolvedValue({
        relativeDate: 'yesterday',
        user: { name: 'John Doe', email: 'johndoad@forestadmin.com' },
      });

      const setup = setupCommandArguments({ getLastPublishedCodeDetails });

      const cmd = new CommandTester(makeCommands(setup), [
        'bootstrap',
        '--env-secret',
        'd4ae505b138c30f2d70952421d738627d65ca5322a27431d067479932cebcfa2',
      ]);
      cmd.answerToQuestion('Do you really want to overwrite these customizations? (yes/no)', 'no');
      await expect(cmd.run()).rejects.toThrow('process exist');

      expect(cmd.outputs).toEqual([
        cmd.text('Bootstrapping project'),
        cmd.success('Environment found'),
        cmd.warning('There is already deployed customization code on your project'),
        cmd.info('Last code pushed yesterday, by John Doe (johndoad@forestadmin.com)'),
        'Do you really want to overwrite these customizations? (yes/no)',
        cmd.error('Operation aborted'),
      ]);
    });
  });
});
