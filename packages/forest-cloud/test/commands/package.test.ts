import fs from 'fs/promises';
import path from 'path';

import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';

describe('package command', () => {
  beforeEach(async () => {
    const setup = setupCommandArguments();
    await fs.rm(setup.distPathManager.distCodeCustomizations, { force: true, recursive: true });
    await fs.rm(setup.distPathManager.zip, { force: true, recursive: true });
  });

  it('should create a zip from the dist folder', async () => {
    const setup = setupCommandArguments();
    const distPath = setup.distPathManager.distCodeCustomizations;
    await fs.mkdir(distPath, { recursive: true });
    const cmd = new CommandTester(setup, ['package']);
    await cmd.run();

    expect(cmd.outputs).toEqual([
      cmd.spinner.start('Packaging code'),
      cmd.spinner.succeed('Code customizations packaged and ready for publish'),
    ]);

    await expect(fs.access(setup.distPathManager.zip)).resolves.not.toThrow();
  });

  describe('when running package before build', () => {
    it('should failed and suggest to run build', async () => {
      const setup = setupCommandArguments();
      const cmd = new CommandTester(setup, ['package']);
      await cmd.run();

      const distPath = path.resolve(setup.distPathManager.distCodeCustomizations);
      expect(cmd.outputs).toEqual([
        cmd.spinner.start('Packaging code'),
        cmd.spinner.fail(
          `No built customization found at ${distPath}.
Please build your code to build your customizations`,
        ),
        cmd.spinner.stop(),
      ]);
    });
  });
});
