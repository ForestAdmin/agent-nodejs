import fs from 'fs';

import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';
import { BusinessError } from '../../src/errors';

jest.mock('fs');

describe('start command', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('when the environment secret is not present', () => {
    it('should get or create the environment secret and save it', async () => {
      const setup = setupCommandArguments();

      jest.mocked(fs.existsSync).mockReturnValue(false);

      const cmd = new CommandTester(setup, ['start']);
      await cmd.run();

      const mockedServer = setup.buildHttpServer({} as any);

      expect(mockedServer.getOrCreateNewDevelopmentEnvironment).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        setup.distPathManager.localCloudEnvironmentConfigPath,
        expect.stringContaining(
          '63f51525814bdfec9dd99690a656757e251770c34549c5f383d909f5cce41eb9":"a784f885c9de4fdfc9cc953659bf6264e60a76e48e8c4af0956aef8f56c6650d"',
        ),
      );
    });
  });

  describe('when the local configuration file does not exist', () => {
    it('should create it', async () => {
      const setup = setupCommandArguments();

      jest.mocked(fs.existsSync).mockReturnValue(false);

      const cmd = new CommandTester(setup, ['start']);
      await cmd.run();

      expect(fs.existsSync).toHaveBeenCalledWith(
        setup.distPathManager.localCloudEnvironmentConfigPath,
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        setup.distPathManager.localCloudEnvironmentConfigPath,
        JSON.stringify({}),
      );
    });
  });

  describe('when the local datasource config file does not exist', () => {
    it('should create the file and stop execution', async () => {
      const setup = setupCommandArguments();
      const error = new BusinessError(
        `Could not find configuration for your local datasource connection options. A new file (${setup.distPathManager.localDatasourcesPath}) has been generated please complete it.`,
      );
      jest.mocked(fs.existsSync).mockReturnValue(false);

      const cmd = new CommandTester(setup, ['start']);

      await cmd.run();

      expect(fs.existsSync).toHaveBeenCalledWith(setup.distPathManager.localDatasourcesPath);
      expect(setup.generateDatasourceConfigFile).toHaveBeenCalled();
      expect(setup.generateDatasourceConfigFile).toHaveBeenCalledWith(
        setup.distPathManager.localDatasourcesPath,
      );
      expect(cmd.outputs).toEqual(expect.arrayContaining([cmd.spinner.fail(error.message)]));
      expect(process.exitCode).toEqual(1);
    });
  });
});
