import SocksProxy from '../../src/connection/services/socks-proxy';

beforeEach(() => jest.clearAllMocks());

const proxyOptions = { host: 'localhost', port: 1088 };

describe('SocksProxy', () => {
  describe('when port is not provided', () => {
    it('should throw an error', async () => {
      const fn = () => new SocksProxy(proxyOptions, 'localhost', null);

      expect(fn).toThrow();
    });
  });

  describe('when host is not provided', () => {
    it('should throw an error', async () => {
      const fn = () => new SocksProxy(proxyOptions, null, 10);

      expect(fn).toThrow();
    });
  });
});
