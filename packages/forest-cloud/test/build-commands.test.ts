import buildCommands from '../src/build-commands';

describe('build commands', () => {
  it('should be able to execute a command', () => {
    expect(() => buildCommands().parse([], { from: 'user' })).not.toThrow();
  });
});
