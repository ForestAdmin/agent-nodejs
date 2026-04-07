import AiClientAdapter from '../../src/adapters/ai-client-adapter';

const mockGetModel = jest.fn().mockReturnValue({ invoke: jest.fn() });
const mockLoadRemoteTools = jest.fn().mockResolvedValue([]);
const mockCloseConnections = jest.fn().mockResolvedValue(undefined);

jest.mock('@forestadmin/ai-proxy', () => ({
  AiClient: jest.fn().mockImplementation(() => ({
    getModel: mockGetModel,
    loadRemoteTools: mockLoadRemoteTools,
    closeConnections: mockCloseConnections,
  })),
}));

describe('AiClientAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delegates getModel to AiClient with aiConfigName from step definition', () => {
    const adapter = new AiClientAdapter([
      { name: 'my-config', provider: 'openai' as const, model: 'gpt-4o', apiKey: 'sk-test' },
    ]);

    adapter.getModel('my-config');

    expect(mockGetModel).toHaveBeenCalledWith('my-config');
  });

  it('delegates getModel without aiConfigName when not set', () => {
    const adapter = new AiClientAdapter([
      { name: 'default', provider: 'openai' as const, model: 'gpt-4o', apiKey: 'sk-test' },
    ]);

    adapter.getModel();

    expect(mockGetModel).toHaveBeenCalledWith(undefined);
  });

  it('delegates loadRemoteTools to AiClient', async () => {
    const adapter = new AiClientAdapter([]);
    const config = { configs: {} };

    await adapter.loadRemoteTools(config);

    expect(mockLoadRemoteTools).toHaveBeenCalledWith(config);
  });

  it('delegates closeConnections to AiClient', async () => {
    const adapter = new AiClientAdapter([]);

    await adapter.closeConnections();

    expect(mockCloseConnections).toHaveBeenCalled();
  });
});
