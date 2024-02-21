import fs from 'fs/promises';

import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';
import { defaultEnvs } from '../../src/services/environment-variables';

describe('bootstrap command', () => {
  describe('when it is the first time to run bootstrap', () => {
    it('should generate the forest-cloud folder', async () => {
      const getEnvironmentVariables = jest
        .fn()
        .mockResolvedValueOnce({
          FOREST_AUTH_TOKEN: null, // auth token is missing because login is required
          ...defaultEnvs,
        })
        .mockResolvedValueOnce({
          FOREST_AUTH_TOKEN: 'a-token-after-login', // auth token is present after login
          ...defaultEnvs,
        });

      const getIntrospection = jest.fn().mockResolvedValue([
        {
          name: 'forestCollection',
          schema: 'public',
          columns: [
            {
              type: { type: 'scalar', subType: 'NUMBER' },
              autoIncrement: true,
              defaultValue: null,
              isLiteralDefaultValue: true,
              name: 'id',
              allowNull: false,
              primaryKey: true,
              constraints: [],
            },
          ],
          unique: [['id'], ['title']],
        },
      ]);

      const setup = setupCommandArguments({ getIntrospection, getEnvironmentVariables });
      const folderPath = setup.bootstrapPathManager.folder;
      await fs.rm(folderPath, { force: true, recursive: true });

      const cmd = new CommandTester(setup, [
        'bootstrap',
        '--env-secret',
        'd4ae505b138c30f2d70952421d738627d65ca5322a27431d067479932cebcfa2',
      ]);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.start('Bootstrapping project'),
        cmd.succeed('Environment found'),
        cmd.start('Bootstrapping project'),
        cmd.succeed(
          'Project successfully bootstrapped. You can start creating your customizations!',
        ),
      ]);

      expect(setup.login).toHaveBeenCalled();
      await expect(fs.access(folderPath)).resolves.not.toThrow();
      expect(await fs.readFile(setup.bootstrapPathManager.index, 'utf-8')).toContain(
        'export default function customizeAgent(agent: Agent<Schema>) {',
      );
      expect(await fs.readFile(setup.bootstrapPathManager.env, 'utf-8')).toContain(
        'FOREST_ENV_SECRET=d4ae505b138c30f2d70952421d738627d65ca5322a27431d067479932cebcfa2',
      );
      const generateDotEnv = await fs.readFile(setup.bootstrapPathManager.env, 'utf-8');
      expect(generateDotEnv.replace(/\s/, '')).not.toContain(
        `FOREST_SERVER_URL=${defaultEnvs.FOREST_SERVER_URL}`,
      );
    });
  });

  describe('when non-default env variable are passed', () => {
    it('should generate the .env with variables saved', async () => {
      const getEnvironmentVariables = jest
        .fn()
        .mockResolvedValueOnce({
          FOREST_AUTH_TOKEN: null, // auth token is missing because login is required
          ...defaultEnvs,
          FOREST_SERVER_URL: 'https://my-awesome-server.com',
          NODE_TLS_REJECT_UNAUTHORIZED: '0',
        })
        .mockResolvedValueOnce({
          FOREST_AUTH_TOKEN: 'a-token-after-login', // auth token is present after login
          ...defaultEnvs,
          FOREST_SERVER_URL: 'https://my-awesome-server.com',
          NODE_TLS_REJECT_UNAUTHORIZED: '0',
        });

      const getIntrospection = jest.fn().mockResolvedValue([]);

      const setup = setupCommandArguments({ getIntrospection, getEnvironmentVariables });
      const cloudCustomizerPath = setup.bootstrapPathManager.folder;
      await fs.rm(cloudCustomizerPath, { force: true, recursive: true });

      const cmd = new CommandTester(setup, [
        'bootstrap',
        '--env-secret',
        'd4ae505b138c30f2d70952421d738627d65ca5322a27431d067479932cebcfa2',
      ]);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.start('Bootstrapping project'),
        cmd.succeed('Environment found'),
        cmd.start('Bootstrapping project'),
        cmd.succeed(
          'Project successfully bootstrapped. You can start creating your customizations!',
        ),
      ]);

      expect(setup.login).toHaveBeenCalled();
      const generateDotEnv = await fs.readFile(setup.bootstrapPathManager.env, 'utf-8');
      expect(generateDotEnv.replace(/\s/, '')).toContain(
        'FOREST_SERVER_URL=https://my-awesome-server.com',
      );
      expect(generateDotEnv.replace(/\s/, '')).toContain('NODE_TLS_REJECT_UNAUTHORIZED=0');
    });

    describe('when given a project folder name', () => {
      it('should create the folder with the given name', async () => {
        const setup = setupCommandArguments();
        setup.bootstrapPathManager.folderName = 'my-project-name';
        const folderPath = setup.bootstrapPathManager.folder;
        await fs.rm(folderPath, { force: true, recursive: true });

        const cmd = new CommandTester(setup, [
          'bootstrap',
          'my-project-name',
          '--env-secret',
          'd4ae505b138c30f2d70952421d738627d65ca5322a27431d067479932cebcfa2',
        ]);
        await cmd.run();

        expect(cmd.outputs).toEqual([
          cmd.start('Bootstrapping project'),
          cmd.succeed('Environment found'),
          cmd.start('Bootstrapping project'),
          cmd.succeed(
            'Project successfully bootstrapped. You can start creating your customizations!',
          ),
        ]);

        await expect(fs.access(folderPath)).resolves.not.toThrow();
      });
    });
  });

  describe('when forest env secret is missing', () => {
    it('should throw an error', async () => {
      const getEnvironmentVariables = jest.fn().mockResolvedValue({});
      const setup = setupCommandArguments({ getEnvironmentVariables });

      const cmd = new CommandTester(setup, ['bootstrap']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.start('Bootstrapping project'),
        cmd.fail(
          // eslint-disable-next-line max-len
          'Your forest env secret is missing. Please provide it with the `bootstrap --env-secret <your-secret-key>` command or add it to your .env file or in environment variables.',
        ),
      ]);
    });
  });

  describe('when there is already a cloud customizer folder', () => {
    it('should throw an error', async () => {
      const setup = setupCommandArguments();
      const folderPath = setup.bootstrapPathManager.folder;
      await fs.rm(folderPath, { force: true, recursive: true });
      await fs.mkdir(folderPath);

      const cmd = new CommandTester(setup, [
        'bootstrap',
        '--env-secret',
        'd4ae505b138c30f2d70952421d738627d65ca5322a27431d067479932cebcfa2',
      ]);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.start('Bootstrapping project'),
        cmd.succeed('Environment found'),
        cmd.start('Bootstrapping project'),
        cmd.fail('You have already a "forest-cloud" folder'),
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
        cmd.start('Bootstrapping project'),
        cmd.succeed('Environment found'),
        cmd.warn('There is already deployed customization code on your project'),
        cmd.info('Last code pushed yesterday, by John Doe (johndoad@forestadmin.com)'),
        'Do you really want to overwrite these customizations? (yes/no)',
        cmd.fail('Operation aborted'),
      ]);
    });
  });
});
