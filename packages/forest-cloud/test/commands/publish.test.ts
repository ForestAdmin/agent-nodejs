import type { MakeCommandsForTests } from './utils';
import type DistPathManager from '../../src/services/dist-path-manager';
import type { ClientRequest, IncomingMessage } from 'http';

import AdmZip from 'adm-zip';
import FormData from 'form-data';
import fs from 'fs/promises';
import path from 'path';

import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';

const createFakeZip = async (distPathManager: DistPathManager) => {
  const { zip: zipPath } = distPathManager;
  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  const zip: AdmZip = new AdmZip();
  await zip.writeZipPromise(zipPath, { overwrite: true });
};

jest.mock('form-data');

describe('publish command', () => {
  async function setupTest(options?): Promise<MakeCommandsForTests> {
    jest.mocked(FormData.prototype.submit).mockImplementation((url, callback) => {
      callback?.(null, { statusCode: 204 } as IncomingMessage);

      return {} as ClientRequest;
    });

    const setup = setupCommandArguments(options);

    await fs.rm(setup.distPathManager.zip, { force: true, recursive: true });
    await createFakeZip(setup.distPathManager);

    return setup;
  }

  it('should publish the code the forest server', async () => {
    const setup = await setupTest();
    const cmd = new CommandTester(setup, ['publish']);
    await cmd.run();

    expect(cmd.outputs).toEqual([
      cmd.spinner.start('Publishing code customizations'),
      cmd.spinner.start('Publishing code customizations'),
      cmd.spinner.succeed('Code customizations published'),
      cmd.spinner.stop(),
    ]);

    await expect(fs.access(setup.distPathManager.zip)).resolves.not.toThrow();
  });

  describe('when there is a previous publication', () => {
    it('should ask to the user to force the publication', async () => {
      const getLastPublishedCodeDetails = jest.fn().mockResolvedValue({
        relativeDate: 'yesterday',
        user: { name: 'John Doe', email: 'johndoad@forestadmin.com' },
      });
      const setup = await setupTest({ getLastPublishedCodeDetails });
      const cmd = new CommandTester(setup, ['publish']);
      cmd.answerToQuestion('Do you really want to overwrite these customizations? (yes/no)', 'no');
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.spinner.start('Publishing code customizations'),
        cmd.spinner.warn('There is already deployed customization code on your project'),
        cmd.spinner.info('Last code pushed yesterday, by John Doe (johndoad@forestadmin.com)'),
        cmd.spinner.info(
          'For the next time, you can publish your customizations with the --force option to skip this step',
        ),
        cmd.spinner.stop(),
        cmd.question('Do you really want to overwrite these customizations? (yes/no) '),
        cmd.spinner.fail('Operation aborted'),
        cmd.spinner.stop(),
      ]);
    });

    describe('when the user wants to force', () => {
      it('should ask to the user to force the publication', async () => {
        const getLastPublishedCodeDetails = jest.fn().mockResolvedValue({
          relativeDate: 'yesterday',
          user: { name: 'John Doe', email: 'johndoad@forestadmin.com' },
        });
        const setup = await setupTest({ getLastPublishedCodeDetails });
        const cmd = new CommandTester(setup, ['publish', '-f']);
        await cmd.run();

        expect(cmd.outputs).toEqual([
          cmd.spinner.start('Publishing code customizations'),
          cmd.spinner.start('Publishing code customizations'),
          cmd.spinner.succeed('Code customizations published'),
          cmd.spinner.stop(),
        ]);
      });
    });
  });

  describe('when the published code has an error', () => {
    it('should display an error', async () => {
      const subscribeToCodeCustomization = jest
        .fn()
        .mockResolvedValue({ error: 'An error occurred' });
      const setup = await setupTest({ subscribeToCodeCustomization });
      const cmd = new CommandTester(setup, ['publish']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.spinner.start('Publishing code customizations'),
        cmd.spinner.start('Publishing code customizations'),
        cmd.spinner.fail('Something went wrong: An error occurred'),
        cmd.spinner.stop(),
      ]);
    });
  });

  describe('when subscribe to the publish process fails', () => {
    it('should display an error', async () => {
      const subscribeToCodeCustomization = jest
        .fn()
        .mockRejectedValue(new Error('An error occurred'));
      const setup = await setupTest({ subscribeToCodeCustomization });
      const cmd = new CommandTester(setup, ['publish']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.spinner.start('Publishing code customizations'),
        cmd.spinner.start('Publishing code customizations'),
        cmd.spinner.fail('An error occurred'),
        cmd.spinner.stop(),
      ]);
    });
  });

  describe('when an error occurred during upload process', () => {
    it('should display an error', async () => {
      const subscribeToCodeCustomization = jest
        .fn()
        .mockRejectedValue(new Error('An error occurred'));
      const setup = await setupTest({ subscribeToCodeCustomization });

      jest.mocked(FormData.prototype.submit).mockImplementation((url, callback) => {
        callback?.(null, { statusCode: 403, statusMessage: 'Forbidden' } as IncomingMessage);

        return {} as ClientRequest;
      });

      const cmd = new CommandTester(setup, ['publish']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.spinner.start('Publishing code customizations'),
        cmd.spinner.start('Publishing code customizations'),
        cmd.spinner.fail('Publish failed: Forbidden'),
        cmd.spinner.stop(),
      ]);
    });
  });
});
