import AlwaysErrorAiModelPort from '../../src/adapters/always-error-ai-model-port';
import { AiModelPortError } from '../../src/errors';

describe('AlwaysErrorAiModelPort', () => {
  let port: AlwaysErrorAiModelPort;

  beforeEach(() => {
    port = new AlwaysErrorAiModelPort();
  });

  describe('getModel', () => {
    it('returns a model whose bindTools().invoke() rejects with AiModelPortError', async () => {
      const model = port.getModel();
      const bound = model.bindTools([], {});

      await expect(bound.invoke([])).rejects.toBeInstanceOf(AiModelPortError);
    });

    it('includes the dev error message in the rejection', async () => {
      const model = port.getModel();
      const bound = model.bindTools([], {});

      await expect(bound.invoke([])).rejects.toMatchObject({
        message: expect.stringContaining('AI forced to always error'),
      });
    });
  });

  describe('loadRemoteTools', () => {
    it('returns an empty array', async () => {
      await expect(port.loadRemoteTools({} as never)).resolves.toEqual([]);
    });
  });

  describe('loadRemoteToolsWithFailures', () => {
    it('returns no tools and no failures', async () => {
      await expect(port.loadRemoteToolsWithFailures({} as never)).resolves.toEqual({
        tools: [],
        failures: [],
      });
    });
  });

  describe('closeConnections', () => {
    it('resolves without error', async () => {
      await expect(port.closeConnections()).resolves.toBeUndefined();
    });
  });
});
