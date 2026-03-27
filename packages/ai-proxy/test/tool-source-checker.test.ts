import ToolSourceChecker from '../src/tool-source-checker';
import { createToolProviders } from '../src/tool-provider-factory';

jest.mock('../src/tool-provider-factory');

describe('ToolSourceChecker', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('check', () => {
    it('should call checkConnection on all providers and return true', async () => {
      const mockProvider1 = {
        checkConnection: jest.fn().mockResolvedValue(true),
        dispose: jest.fn().mockResolvedValue(undefined),
        loadTools: jest.fn(),
      };
      const mockProvider2 = {
        checkConnection: jest.fn().mockResolvedValue(true),
        dispose: jest.fn().mockResolvedValue(undefined),
        loadTools: jest.fn(),
      };
      jest.mocked(createToolProviders).mockReturnValue([mockProvider1, mockProvider2]);

      const result = await ToolSourceChecker.check({
        server1: { command: 'test', args: [] },
      });

      expect(result).toBe(true);
      expect(mockProvider1.checkConnection).toHaveBeenCalled();
      expect(mockProvider2.checkConnection).toHaveBeenCalled();
    });

    it('should dispose all providers after check', async () => {
      const mockProvider = {
        checkConnection: jest.fn().mockResolvedValue(true),
        dispose: jest.fn().mockResolvedValue(undefined),
        loadTools: jest.fn(),
      };
      jest.mocked(createToolProviders).mockReturnValue([mockProvider]);

      await ToolSourceChecker.check({ server1: { command: 'test', args: [] } });

      expect(mockProvider.dispose).toHaveBeenCalled();
    });

    it('should dispose providers even when checkConnection fails', async () => {
      const mockProvider = {
        checkConnection: jest.fn().mockRejectedValue(new Error('Connection failed')),
        dispose: jest.fn().mockResolvedValue(undefined),
        loadTools: jest.fn(),
      };
      jest.mocked(createToolProviders).mockReturnValue([mockProvider]);

      await expect(
        ToolSourceChecker.check({ server1: { command: 'test', args: [] } }),
      ).rejects.toThrow('Connection failed');

      expect(mockProvider.dispose).toHaveBeenCalled();
    });

    it('should pass logger to createToolProviders', async () => {
      jest.mocked(createToolProviders).mockReturnValue([]);
      const logger = jest.fn();

      await ToolSourceChecker.check({ server1: { command: 'test', args: [] } }, logger);

      expect(createToolProviders).toHaveBeenCalledWith(
        { server1: { command: 'test', args: [] } },
        logger,
      );
    });
  });
});
