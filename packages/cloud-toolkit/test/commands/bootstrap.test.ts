import fs from 'fs/promises';

import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';

describe('bootstrap command', () => {
  beforeEach(async () => {
    await fs.rm('cloud-customizer', { force: true, recursive: true });
  });

  describe('when forest env secret is missing', () => {
    it('should throw an error', async () => {
      const getOrRefreshEnvironmentVariables = jest.fn().mockResolvedValue({});
      const setup = setupCommandArguments({ getOrRefreshEnvironmentVariables });

      const cmd = new CommandTester(setup, ['bootstrap']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.text('Bootstrapping project'),
        cmd.error(
          // eslint-disable-next-line max-len
          'Your forest env secret is missing. Please provide it with the `bootstrap --env-secret <your-secret-key>` command or add it to your .env file or in environment variables.',
        ),
      ]);
    });
  });

  describe('when there is already a cloud customizer folder', () => {
    it('should throw an error', async () => {
      const getOrRefreshEnvironmentVariables = jest.fn().mockResolvedValue({});
      const setup = setupCommandArguments({ getOrRefreshEnvironmentVariables });

      await fs.mkdir('cloud-customizer');

      const cmd = new CommandTester(setup, [
        'bootstrap',
        '--env-secret',
        'd4ae505b138c30f2d70952421d738627d65ca5322a27431d067479932cebcfa2',
      ]);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.text('Bootstrapping project'),
        cmd.success('Environment found'),
        cmd.text('Bootstrapping project'),
        cmd.error('You have already a cloud-customizer folder'),
      ]);
    });
  });

  describe('when the project has already customization code', () => {
    it('should ask to the customer if he wants to bootstrap again', async () => {
      const getLastPublishedCodeDetails = jest.fn().mockResolvedValue({
        relativeDate: 'yesterday',
        user: { name: 'John Doe', email: 'johndoad@forestadmin.com' },
      });

      const setup = setupCommandArguments({ getLastPublishedCodeDetails });

      const cmd = new CommandTester(setup, [
        'bootstrap',
        '--env-secret',
        'd4ae505b138c30f2d70952421d738627d65ca5322a27431d067479932cebcfa2',
      ]);
      cmd.answerToQuestion('Do you really want to overwrite these customizations? (yes/no)', 'no');
      await cmd.run();

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
