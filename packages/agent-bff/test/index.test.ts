import * as pkg from '../src/index';

describe('package index', () => {
  describe('when importing the public entry point', () => {
    it('should re-export the runtime values', () => {
      expect(pkg.BFFHttpServer).toBeDefined();
      expect(pkg.parseConfig).toEqual(expect.any(Function));
      expect(pkg.REQUIRED_KEYS).toEqual(expect.any(Array));
      expect(pkg.runCli).toEqual(expect.any(Function));
      expect(pkg.ConfigurationError).toBeDefined();
      expect(pkg.DEFAULT_BFF_PORT).toEqual(expect.any(Number));
      expect(pkg.createConsoleLogger).toEqual(expect.any(Function));
      expect(pkg.version).toEqual(expect.any(String));
    });
  });
});
