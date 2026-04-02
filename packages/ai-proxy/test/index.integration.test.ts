// eslint-disable-next-line import/extensions
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { validToolConfigurationOrThrow } from '../src';
import runMcpServer from '../src/examples/simple-mcp-server';

describe('Simple MCP Server', () => {
  let server: ReturnType<typeof runMcpServer>;

  beforeAll(() => {
    const mcp = new McpServer({ name: 'simpleServer', version: '1.0.0' });
    mcp.registerTool('fake', {}, () => {
      return { content: [{ type: 'text' as const, text: 'fake it' }] };
    });
    server = runMcpServer(mcp, 3123);
  });

  afterAll(() => {
    server.close();
  });

  describe('validToolConfigurationOrThrow', () => {
    it('should return true when the config is right', async () => {
      const result = await validToolConfigurationOrThrow({
        simpleServer: {
          url: 'http://localhost:3123/mcp',
          type: 'http',
          headers: {
            Authorization: `Bearer your-secure-token-here`,
          },
        },
      });

      expect(result).toBe(true);
    });

    it('should throw an error when the config is wrong', async () => {
      await expect(
        validToolConfigurationOrThrow({
          simpleServer: { url: 'http://localhost:3123/wrong', type: 'http' },
        }),
      ).rejects.toThrow('Failed to connect to streamable HTTP');
    });
  });
});
