import AdmZip from 'adm-zip';
import fs from 'fs/promises';
import path from 'path';

import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';
import DistPathManager from '../../src/services/dist-path-manager';

const createFakeZip = async (distPathManager: DistPathManager) => {
  const { zip: zipPath } = distPathManager;
  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  const zip: AdmZip = new AdmZip();
  await zip.writeZipPromise(zipPath, { overwrite: true });
};

describe('publish command', () => {
  beforeEach(async () => {
    const setup = setupCommandArguments();

    await fs.rm(setup.distPathManager.zip, { force: true, recursive: true });
    await createFakeZip(setup.distPathManager);
  });

  it('should publish the code the forest server', async () => {
    const setup = setupCommandArguments();
    const cmd = new CommandTester(setup, ['publish']);
    await cmd.run();

    expect(cmd.outputs).toEqual([
      cmd.start('Publishing code customizations'),
      cmd.start('Publishing code customizations (operation cannot be cancelled)'),
      cmd.succeed('Code customizations published'),
    ]);

    await expect(fs.access(setup.distPathManager.zip)).resolves.not.toThrow();
  });

  describe('when there is a previous publication', () => {
    it('should ask to the user to force the publication', async () => {
      const getLastPublishedCodeDetails = jest.fn().mockResolvedValue({
        relativeDate: 'yesterday',
        user: { name: 'John Doe', email: 'johndoad@forestadmin.com' },
      });
      const setup = setupCommandArguments({ getLastPublishedCodeDetails });
      const cmd = new CommandTester(setup, ['publish']);
      cmd.answerToQuestion('Do you really want to overwrite these customizations? (yes/no)', 'no');
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.start('Publishing code customizations'),
        cmd.warn('There is already deployed customization code on your project'),
        cmd.info('Last code pushed yesterday, by John Doe (johndoad@forestadmin.com)'),
        'Do you really want to overwrite these customizations? (yes/no)',
        cmd.fail('Operation aborted'),
      ]);
    });

    describe('when the user wants to force', () => {
      it('should ask to the user to force the publication', async () => {
        const getLastPublishedCodeDetails = jest.fn().mockResolvedValue({
          relativeDate: 'yesterday',
          user: { name: 'John Doe', email: 'johndoad@forestadmin.com' },
        });
        const setup = setupCommandArguments({ getLastPublishedCodeDetails });
        const cmd = new CommandTester(setup, ['publish', '-f']);
        await cmd.run();

        expect(cmd.outputs).toEqual([
          cmd.start('Publishing code customizations'),
          cmd.start('Publishing code customizations (operation cannot be cancelled)'),
          cmd.succeed('Code customizations published'),
        ]);
      });
    });
  });

  describe('when the published code has an error', () => {
    it('should display an error', async () => {
      const subscribeToCodeCustomization = jest
        .fn()
        .mockResolvedValue({ error: 'An error occurred' });
      const setup = setupCommandArguments({ subscribeToCodeCustomization });
      const cmd = new CommandTester(setup, ['publish']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.start('Publishing code customizations'),
        cmd.start('Publishing code customizations (operation cannot be cancelled)'),
        cmd.fail('Something went wrong: An error occurred'),
      ]);
    });
  });

  describe('when subscribe to the publish process fails', () => {
    it('should display an error', async () => {
      const subscribeToCodeCustomization = jest
        .fn()
        .mockRejectedValue(new Error('An error occurred'));
      const setup = setupCommandArguments({ subscribeToCodeCustomization });
      const cmd = new CommandTester(setup, ['publish']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.start('Publishing code customizations'),
        cmd.start('Publishing code customizations (operation cannot be cancelled)'),
        cmd.fail('An error occurred'),
      ]);
    });
  });
});
