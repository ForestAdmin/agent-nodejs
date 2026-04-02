import BraveToolProvider from '../../../src/integrations/brave/brave-tool-provider';

const mockBraveTools = [{ name: 'brave_search' }];

jest.mock('../../../src/integrations/brave/tools', () => ({
  __esModule: true,
  default: jest.fn(() => mockBraveTools),
}));

describe('BraveToolProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('loadTools', () => {
    it('should return brave tools', async () => {
      const provider = new BraveToolProvider({ apiKey: 'test-key' });

      const tools = await provider.loadTools();

      expect(tools).toEqual(mockBraveTools);
    });
  });

  describe('checkConnection', () => {
    it('should return true', async () => {
      const provider = new BraveToolProvider({ apiKey: 'test-key' });

      const result = await provider.checkConnection();

      expect(result).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should resolve without error', async () => {
      const provider = new BraveToolProvider({ apiKey: 'test-key' });

      await expect(provider.dispose()).resolves.toBeUndefined();
    });
  });
});
