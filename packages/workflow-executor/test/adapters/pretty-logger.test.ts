import createPrettyLogger from '../../src/adapters/pretty-logger';

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1B\[[0-9;]*m/g;
const stripAnsi = (s: string): string => s.replace(ANSI_PATTERN, '');

describe('createPrettyLogger', () => {
  let logger: ReturnType<typeof createPrettyLogger>;
  let infoSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = createPrettyLogger();
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('Info', () => {
    it('prints the timestamp, level, message and context', () => {
      logger('Info', 'Poll cycle completed', { fetched: 0, dispatching: 0 });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      const output = stripAnsi(infoSpy.mock.calls[0][0] as string);
      expect(output).toMatch(
        /^\d{2}:\d{2}:\d{2} info {2}Poll cycle completed fetched=0 dispatching=0$/,
      );
    });

    it('omits the context chunk when empty', () => {
      logger('Info', 'Ready', {});

      const output = stripAnsi(infoSpy.mock.calls[0][0] as string);
      expect(output).toMatch(/^\d{2}:\d{2}:\d{2} info {2}Ready$/);
    });

    it('omits the context chunk when the arg is missing', () => {
      logger('Info', 'Ready');

      const output = stripAnsi(infoSpy.mock.calls[0][0] as string);
      expect(output).toMatch(/^\d{2}:\d{2}:\d{2} info {2}Ready$/);
    });

    it('JSON-quotes string values in context', () => {
      logger('Info', 'Step execution started', { runId: '42', stepIndex: 2 });

      const output = stripAnsi(infoSpy.mock.calls[0][0] as string);
      expect(output).toContain('runId="42"');
      expect(output).toContain('stepIndex=2');
    });

    it('preserves context insertion order', () => {
      logger('Info', 'ordered', { a: 1, b: 2, c: 3 });

      const output = stripAnsi(infoSpy.mock.calls[0][0] as string);
      expect(output).toMatch(/a=1 b=2 c=3$/);
    });
  });

  describe('Error', () => {
    it('prints on console.error with "error" level', () => {
      logger('Error', 'Poll cycle failed', { error: 'timeout' });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).not.toHaveBeenCalled();
      const output = stripAnsi(errorSpy.mock.calls[0][0] as string);
      expect(output).toMatch(/^\d{2}:\d{2}:\d{2} error Poll cycle failed error="timeout"$/);
    });
  });

  describe('Warn', () => {
    it('prints on console.warn with "warn" level', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      logger('Warn', 'rate limit approaching', { remaining: 5 });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).not.toHaveBeenCalled();
      const output = stripAnsi(warnSpy.mock.calls[0][0] as string);
      expect(output).toMatch(/^\d{2}:\d{2}:\d{2} warn {2}rate limit approaching remaining=5$/);

      warnSpy.mockRestore();
    });
  });

  describe('level filtering', () => {
    it('drops messages strictly below the configured minimum', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const filtered = createPrettyLogger('Warn');

      filtered('Debug', 'dbg');
      filtered('Info', 'info');
      filtered('Warn', 'warn');
      filtered('Error', 'err');

      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });
  });
});
