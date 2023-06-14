import ReverseProxy from '../../src/connection/reverse-proxy';

beforeEach(() => jest.clearAllMocks());

const proxyOptions = { host: 'localhost', port: 1088 };

describe('ReverseProxy', () => {
  describe('when port is not provided', () => {
    it('should throw an error', async () => {
      const fn = () => new ReverseProxy(proxyOptions, 'localhost', null);

      expect(fn).toThrow();
    });
  });

  describe('when host is not provided', () => {
    it('should throw an error', async () => {
      const fn = () => new ReverseProxy(proxyOptions, null, 10);

      expect(fn).toThrow();
    });
  });
});
