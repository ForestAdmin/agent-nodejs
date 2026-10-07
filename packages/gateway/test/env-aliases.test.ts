import EnvAliases from '../src/env-aliases';

describe('EnvAliases', () => {
  describe('resolve', () => {
    it('should read the new name without warning', () => {
      const aliases = new EnvAliases({ PORT: '8080' });

      expect(aliases.resolve('PORT', ['HTTP_PORT'])).toEqual({ key: 'PORT', value: '8080' });
      expect(aliases.warnings).toEqual([]);
    });

    it('should fall back to the new name as key when nothing is set', () => {
      const aliases = new EnvAliases({});

      expect(aliases.resolve('PORT', ['HTTP_PORT'])).toEqual({ key: 'PORT' });
      expect(aliases.warnings).toEqual([]);
    });

    it('should read an alias and warn naming both keys', () => {
      const aliases = new EnvAliases({ HTTP_PORT: '8080' });

      expect(aliases.resolve('PORT', ['HTTP_PORT'])).toEqual({ key: 'HTTP_PORT', value: '8080' });
      expect(aliases.warnings).toEqual(['HTTP_PORT is a legacy name: use PORT instead']);
    });

    it('should let a non-empty new name win, false included', () => {
      const aliases = new EnvAliases({ NEW: 'false', OLD: 'true' });

      expect(aliases.resolve('NEW', ['OLD'])).toEqual({ key: 'NEW', value: 'false' });
    });

    it('should warn about a shadowed alias without validating it', () => {
      const aliases = new EnvAliases({ PORT: '8080', HTTP_PORT: 'abc', MCP_SERVER_PORT: 'abc' });

      expect(aliases.resolve('PORT', ['MCP_SERVER_PORT', 'HTTP_PORT'])).toEqual({
        key: 'PORT',
        value: '8080',
      });
      expect(aliases.warnings).toEqual([
        'MCP_SERVER_PORT is ignored: PORT is set',
        'HTTP_PORT is ignored: PORT is set',
      ]);
    });

    it.each(['', '  '])('should treat a new name set to %p as unset', empty => {
      const aliases = new EnvAliases({ NEW: empty, OLD: 'value' });

      expect(aliases.resolve('NEW', ['OLD'])).toEqual({ key: 'OLD', value: 'value' });
    });

    it('should ignore an empty alias', () => {
      const aliases = new EnvAliases({ OLD: '' });

      expect(aliases.resolve('NEW', ['OLD'])).toEqual({ key: 'NEW' });
      expect(aliases.warnings).toEqual([]);
    });

    it('should fail naming two aliases that disagree', () => {
      const aliases = new EnvAliases({ HTTP_PORT: '8080', MCP_SERVER_PORT: '3931' });

      expect(() => aliases.resolve('PORT', ['MCP_SERVER_PORT', 'HTTP_PORT'])).toThrow(
        'MCP_SERVER_PORT and HTTP_PORT disagree: set PORT to the value the Gateway should use.',
      );
    });

    it('should accept two aliases that agree, warning about each', () => {
      const aliases = new EnvAliases({ HTTP_PORT: '8080', MCP_SERVER_PORT: ' 8080 ' });

      expect(aliases.resolve('PORT', ['MCP_SERVER_PORT', 'HTTP_PORT'])).toEqual({
        key: 'MCP_SERVER_PORT',
        value: ' 8080 ',
      });
      expect(aliases.warnings).toEqual([
        'MCP_SERVER_PORT is a legacy name: use PORT instead',
        'HTTP_PORT is a legacy name: use PORT instead',
      ]);
    });

    it('should never put a value in a warning', () => {
      const aliases = new EnvAliases({ OLD_SECRET: 'top-secret', NEW_SECRET: 'other-secret' });

      aliases.resolve('NEW_SECRET', ['OLD_SECRET']);

      expect(aliases.warnings.join('\n')).not.toMatch(/top-secret|other-secret/);
    });
  });

  describe('ignore', () => {
    it('should warn about each set key with the reason', () => {
      const aliases = new EnvAliases({ A: 'x', B: '', C: 'y' });

      aliases.ignore(['A', 'B', 'C'], 'not read');

      expect(aliases.warnings).toEqual(['A is ignored: not read', 'C is ignored: not read']);
    });
  });
});
