import * as bff from '../src/index';

describe('package index', () => {
  describe('when importing the public surface', () => {
    it('should export every advertised value symbol', () => {
      expect(bff.BFFHttpServer).toBeDefined();
      expect(bff.parseConfig).toBeDefined();
      expect(bff.REQUIRED_KEYS).toBeDefined();
      expect(bff.runCli).toBeDefined();
      expect(bff.ConfigurationError).toBeDefined();
      expect(bff.DEFAULT_BFF_PORT).toBeDefined();
      expect(bff.createConsoleLogger).toBeDefined();
      expect(bff.version).toBeDefined();
      expect(bff.ForestServerClient).toBeDefined();
      expect(bff.OAuthExchangeError).toBeDefined();
      expect(bff.createOAuthRoutes).toBeDefined();
      expect(bff.createInMemorySessionStore).toBeDefined();
      expect(bff.createTokenCipher).toBeDefined();
      expect(bff.ensureFreshServerAccess).toBeDefined();
      expect(bff.issueBffAccessToken).toBeDefined();
      expect(bff.BFF_ACCESS_TOKEN_TYPE).toBeDefined();
      expect(bff.createPkcePair).toBeDefined();
      expect(bff.OAuthRequestError).toBeDefined();
    });
  });
});
