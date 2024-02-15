import buildCommand from '../src/build-command';

describe('command', () => {
  it('should be able to execute a command', async () => {
    expect(() => buildCommand().parse(['help'], { from: 'user' })).not.toThrow();
  });
});
