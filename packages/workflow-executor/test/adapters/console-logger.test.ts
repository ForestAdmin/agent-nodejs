import createConsoleLogger from '../../src/adapters/console-logger';

describe('createConsoleLogger', () => {
  let logger: ReturnType<typeof createConsoleLogger>;

  beforeEach(() => {
    logger = createConsoleLogger();
  });

  it('Info level writes to console.info as JSON', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation();

    logger('Info', 'test message', { key: 'value' });

    expect(spy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output).toMatchObject({ level: 'Info', message: 'test message', key: 'value' });
    expect(output.timestamp).toBeDefined();

    spy.mockRestore();
  });

  it('Warn level writes to console.warn as JSON', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation();

    logger('Warn', 'something suspicious', { count: 3 });

    expect(spy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output).toMatchObject({ level: 'Warn', message: 'something suspicious', count: 3 });
    expect(output.timestamp).toBeDefined();

    spy.mockRestore();
  });

  it('Error level writes to console.error as JSON', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();

    logger('Error', 'boom', { code: 'E1' });

    expect(spy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output).toMatchObject({ level: 'Error', message: 'boom', code: 'E1' });

    spy.mockRestore();
  });

  it('omits log calls below the configured minimum level', () => {
    const filtered = createConsoleLogger('Warn');
    const infoSpy = jest.spyOn(console, 'info').mockImplementation();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    filtered('Debug', 'dbg');
    filtered('Info', 'info');
    filtered('Warn', 'warn');
    filtered('Error', 'err');

    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('accepts a missing context argument', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation();

    logger('Info', 'no ctx');

    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output).toMatchObject({ level: 'Info', message: 'no ctx' });

    spy.mockRestore();
  });
});
