import PrettyLogger from '../../src/adapters/pretty-logger';

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1B\[[0-9;]*m/g;
const stripAnsi = (s: string): string => s.replace(ANSI_PATTERN, '');

describe('PrettyLogger', () => {
  let logger: PrettyLogger;
  let infoSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new PrettyLogger();
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('info', () => {
    it('prints the timestamp, level, message and context', () => {
      logger.info('Poll cycle completed', { fetched: 0, dispatching: 0 });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      const output = stripAnsi(infoSpy.mock.calls[0][0] as string);
      expect(output).toMatch(
        /^\d{2}:\d{2}:\d{2} info {2}Poll cycle completed fetched=0 dispatching=0$/,
      );
    });

    it('omits the context chunk when empty', () => {
      logger.info('Ready', {});

      const output = stripAnsi(infoSpy.mock.calls[0][0] as string);
      expect(output).toMatch(/^\d{2}:\d{2}:\d{2} info {2}Ready$/);
    });

    it('JSON-quotes string values in context', () => {
      logger.info('Step execution started', { runId: '42', stepIndex: 2 });

      const output = stripAnsi(infoSpy.mock.calls[0][0] as string);
      expect(output).toContain('runId="42"');
      expect(output).toContain('stepIndex=2');
    });

    it('preserves context insertion order', () => {
      logger.info('ordered', { a: 1, b: 2, c: 3 });

      const output = stripAnsi(infoSpy.mock.calls[0][0] as string);
      expect(output).toMatch(/a=1 b=2 c=3$/);
    });
  });

  describe('error', () => {
    it('prints on console.error with "error" level', () => {
      logger.error('Poll cycle failed', { error: 'timeout' });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).not.toHaveBeenCalled();
      const output = stripAnsi(errorSpy.mock.calls[0][0] as string);
      expect(output).toMatch(/^\d{2}:\d{2}:\d{2} error Poll cycle failed error="timeout"$/);
    });
  });
});
