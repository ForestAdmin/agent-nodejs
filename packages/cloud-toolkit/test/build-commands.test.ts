import buildCommands from '../src/build-command';

describe('build commands', () => {
  it('should be able to execute a command', () => {
    jest.clearAllMocks();
    (process.exit as unknown as jest.Mock) = jest.fn();

    expect(() =>
      buildCommands().parse(['bootstrap', '-e', 'bad-secret'], { from: 'user' }),
    ).not.toThrow();
  });
});
