import ConsoleLogger from '../../src/adapters/console-logger';

describe('ConsoleLogger', () => {
  let logger: ConsoleLogger;

  beforeEach(() => {
    logger = new ConsoleLogger();
  });

  it('info() writes to console.info as JSON', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation();

    logger.info('test message', { key: 'value' });

    expect(spy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output).toMatchObject({ message: 'test message', key: 'value' });
    expect(output.timestamp).toBeDefined();

    spy.mockRestore();
  });

  it('warn() writes to console.warn as JSON', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation();

    logger.warn('something suspicious', { count: 3 });

    expect(spy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output).toMatchObject({ message: 'something suspicious', count: 3 });
    expect(output.timestamp).toBeDefined();

    spy.mockRestore();
  });
});
