import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { validMcpConfigurationOrThrow } from '../src';
import runMcpServer from '../src/examples/simple-mcp-server';

describe('Simple MCP Server', () => {
  let server: ReturnType<typeof runMcpServer>;

  beforeAll(() => {
    const mcp = new McpServer({ name: 'simpleServer', version: '1.0.0' });
    mcp.tool('fake', () => {
      return { content: [{ type: 'text', text: 'fake it' }] };
    });
    server = runMcpServer(mcp, 3123);
  });

  afterAll(() => {
    server.close();
  });

  describe('validMcpConfigurationOrThrow', () => {
    it('should return true when the config is right', async () => {
      const result = await validMcpConfigurationOrThrow({
        configs: {
          simpleServer: {
            url: 'http://localhost:3123/mcp',
            type: 'http',
            headers: {
              Authorization: `Bearer your-secure-token-here`,
            },
          },
        },
      });

      expect(result).toBe(true);
    });

    it('should throw an error when the config is wrong', async () => {
      await expect(
        validMcpConfigurationOrThrow({
          configs: {
            simpleServer: { url: 'http://localhost:3123/wrong', type: 'http' },
          },
        }),
      ).rejects.toThrow('Failed to connect to streamable HTTP');
    });
  });
});
