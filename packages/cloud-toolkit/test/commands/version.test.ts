import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';

describe('version command', () => {
  it('should display the version', async () => {
    const setup = setupCommandArguments();
    const cmd = new CommandTester(setup, ['--version']);
    await cmd.run();

    expect(cmd.outputs).toEqual([expect.any(String)]);
  });
});
