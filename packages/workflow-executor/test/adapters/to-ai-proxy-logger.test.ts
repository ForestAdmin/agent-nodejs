import createConsoleLogger from '../../src/adapters/console-logger';
import toAiProxyLogger from '../../src/adapters/to-ai-proxy-logger';

describe('toAiProxyLogger', () => {
  let logger: jest.Mock;
  let aiProxyLogger: ReturnType<typeof toAiProxyLogger>;

  beforeEach(() => {
    logger = jest.fn();
    aiProxyLogger = toAiProxyLogger(logger);
  });

  describe('without a cause', () => {
    it('forwards every level and message unchanged, adding no context', () => {
      aiProxyLogger('Debug', 'Loaded 3 tools from MCP server "notion" in 12ms');
      aiProxyLogger('Info', 'Using AI configuration default');
      aiProxyLogger('Warn', 'Unsupported integration: stripe');
      aiProxyLogger('Error', 'Error during tool provider cleanup');

      expect(logger.mock.calls).toEqual([
        ['Debug', 'Loaded 3 tools from MCP server "notion" in 12ms'],
        ['Info', 'Using AI configuration default'],
        ['Warn', 'Unsupported integration: stripe'],
        ['Error', 'Error during tool provider cleanup'],
      ]);
    });
  });

  describe('with an Error cause', () => {
    it('flattens the cause into enumerable error and stack context', () => {
      const cause = new Error('401 Unauthorized');

      aiProxyLogger('Error', 'Error loading tools for notion', cause);

      expect(logger).toHaveBeenCalledWith('Error', 'Error loading tools for notion', {
        error: '401 Unauthorized',
        stack: cause.stack,
      });
    });

    // The reason the wrapper exists: an Error's own properties are non-enumerable, so a logger
    // that spreads the context into JSON.stringify emits the line with the cause silently gone.
    it('keeps the cause readable in the default-level console logger output', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();

      toAiProxyLogger(createConsoleLogger())(
        'Error',
        'Error loading tools for notion',
        new Error('401 Unauthorized'),
      );

      const output = JSON.parse(spy.mock.calls[0][0]);
      expect(output).toMatchObject({
        level: 'Error',
        message: 'Error loading tools for notion',
        error: '401 Unauthorized',
      });
      expect(output.stack).toContain('Error: 401 Unauthorized');

      spy.mockRestore();
    });

    // A wrapped `TypeError: fetch failed` is the difference between "server unreachable" and "401".
    it('reports the cause of a wrapped error alongside its own message', () => {
      const wrapped = Object.assign(new Error('fetch failed'), {
        cause: new Error('ECONNREFUSED 127.0.0.1:9100'),
      });

      aiProxyLogger('Error', 'Error loading tools for notion', wrapped);

      expect(logger).toHaveBeenCalledWith('Error', 'Error loading tools for notion', {
        error: 'fetch failed',
        cause: 'ECONNREFUSED 127.0.0.1:9100',
        stack: wrapped.stack,
      });
    });

    it('reports a stackless Error by its message alone', () => {
      const cause = new Error('boom');
      delete cause.stack;

      aiProxyLogger('Error', 'Error loading tools for notion', cause);

      expect(logger).toHaveBeenCalledWith('Error', 'Error loading tools for notion', {
        error: 'boom',
        stack: undefined,
      });
    });

    it('falls back to the error name when the Error carries an empty message', () => {
      aiProxyLogger('Error', 'Error loading tools for notion', new Error(''));

      expect(logger).toHaveBeenCalledWith(
        'Error',
        'Error loading tools for notion',
        expect.objectContaining({ error: 'Error' }),
      );
    });

    it('keeps each call independent when several servers fail in the same load', () => {
      aiProxyLogger('Error', 'Error loading tools for notion', new Error('401 Unauthorized'));
      aiProxyLogger('Error', 'Error loading tools for jira', new Error('ECONNREFUSED'));
      aiProxyLogger('Warn', 'Unsupported integration: stripe');

      expect(logger.mock.calls).toEqual([
        [
          'Error',
          'Error loading tools for notion',
          { error: '401 Unauthorized', stack: expect.any(String) },
        ],
        [
          'Error',
          'Error loading tools for jira',
          { error: 'ECONNREFUSED', stack: expect.any(String) },
        ],
        ['Warn', 'Unsupported integration: stripe'],
      ]);
    });
  });

  // ai-proxy logs from inside its catch blocks before recording the failure, so a throw here would
  // fail a whole tool load — including the OAuth reauth path — instead of one server's load.
  describe('when the host logger throws', () => {
    it('keeps the throw away from ai-proxy, with and without a cause', () => {
      const throwing = jest.fn(() => {
        throw new Error('host logger exploded');
      });
      const guarded = toAiProxyLogger(throwing);

      expect(() =>
        guarded('Error', 'Error loading tools for notion', new Error('401 Unauthorized')),
      ).not.toThrow();
      expect(() => guarded('Warn', 'Unsupported integration: stripe')).not.toThrow();
      expect(throwing).toHaveBeenCalledTimes(2);
    });
  });

  describe('with a cause that is not an Error', () => {
    // ai-proxy casts what it catches (`error as Error`), so any thrown value reaches the wrapper.
    it('stringifies the thrown value and reports no stack', () => {
      aiProxyLogger('Error', 'Error loading tools for notion', 'kaboom' as unknown as Error);

      expect(logger).toHaveBeenCalledWith('Error', 'Error loading tools for notion', {
        error: 'kaboom',
        stack: undefined,
      });
    });

    it('treats a null cause as no cause instead of logging "null"', () => {
      aiProxyLogger('Error', 'Error loading tools for notion', null as unknown as Error);

      expect(logger).toHaveBeenCalledWith('Error', 'Error loading tools for notion');
    });
  });
});
