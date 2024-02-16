import buildCommands from '../src/build-command';

describe('build commands', () => {
  it('should be able to execute a command', async () => {
    expect(() => buildCommands().parse(['help'], { from: 'user' })).not.toThrow();
  });
});
