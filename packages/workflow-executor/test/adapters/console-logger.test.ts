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
});
