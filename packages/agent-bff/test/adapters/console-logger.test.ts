import createConsoleLogger from '../../src/adapters/console-logger';

describe('createConsoleLogger', () => {
  let info: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when the level is at or above the minimum', () => {
    it('should route Info to console.info with a JSON payload carrying level and message', () => {
      const logger = createConsoleLogger('Info');

      logger('Info', 'hello');

      expect(info).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(info.mock.calls[0][0] as string);
      expect(payload).toMatchObject({ level: 'Info', message: 'hello' });
      expect(payload.timestamp).toEqual(expect.any(String));
    });

    it('should route Warn to console.warn and Error to console.error', () => {
      const logger = createConsoleLogger('Info');

      logger('Warn', 'careful');
      logger('Error', 'boom');

      expect(warn).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledTimes(1);
    });

    it('should merge the context object into the payload', () => {
      const logger = createConsoleLogger('Info');

      logger('Info', 'with ctx', { renderingId: 17 });

      const payload = JSON.parse(info.mock.calls[0][0] as string);
      expect(payload.renderingId).toBe(17);
    });
  });

  describe('when the context carries a reserved key', () => {
    it('should rename status, severity and syslog so they cannot override the level in Datadog', () => {
      const logger = createConsoleLogger('Info');

      logger('Warn', 'upstream failed', {
        status: 503,
        severity: 'low',
        syslog: { severity: 2 },
      });

      const payload = JSON.parse(warn.mock.calls[0][0] as string);
      expect(payload).toEqual({
        level: 'Warn',
        message: 'upstream failed',
        timestamp: expect.any(String),
        context_status: 503,
        context_severity: 'low',
        context_syslog: { severity: 2 },
      });
    });

    it('should rename level, message and timestamp so they cannot overwrite the fields the logger sets', () => {
      const logger = createConsoleLogger('Info');

      logger('Error', 'boom', { level: 'Info', message: 'other', timestamp: 'yesterday' });

      const payload = JSON.parse(error.mock.calls[0][0] as string);
      expect(payload).toEqual({
        level: 'Error',
        message: 'boom',
        timestamp: expect.not.stringMatching(/^yesterday$/),
        context_level: 'Info',
        context_message: 'other',
        context_timestamp: 'yesterday',
      });
    });
  });

  describe('when the level is below the minimum', () => {
    it('should drop the entry without calling console', () => {
      const logger = createConsoleLogger('Warn');

      logger('Info', 'should be filtered');
      logger('Debug', 'also filtered');

      expect(info).not.toHaveBeenCalled();
    });
  });

  describe('when no minimum level is provided', () => {
    it('should default to Info and drop Debug', () => {
      const logger = createConsoleLogger();

      logger('Debug', 'noisy');

      expect(info).not.toHaveBeenCalled();
    });
  });
});
