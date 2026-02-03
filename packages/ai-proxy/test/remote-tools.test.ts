import type { Tool } from '@langchain/core/tools';
import type { JSONSchema } from '@langchain/core/utils/json_schema';

import { toJsonSchema } from '@langchain/core/utils/json_schema';

import { RemoteTools } from '../src';
import ServerRemoteTool from '../src/server-remote-tool';

describe('RemoteTools', () => {
  const apiKeys = { AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY: 'api-key' };

  describe('when AI_REMOTE_TOOL_BRAVE_SEARCH_API_KEY is not set', () => {
    it('should not add the tool', () => {
      const remoteTools = new RemoteTools({});
      expect(remoteTools.tools.length).toEqual(0);
    });
  });

  describe('when envs is null', () => {
    it('should init the remote tool instance without error', () => {
      expect(() => new RemoteTools(null)).not.toThrow();
    });
  });

  describe('tools', () => {
    it('should return the tools', () => {
      const remoteTools = new RemoteTools(apiKeys);
      expect(remoteTools.tools.length).toEqual(1);
    });

    describe('when tools are passed in the constructor', () => {
      it('should return the tools', () => {
        const tools = [
          new ServerRemoteTool({
            tool: {
              name: 'tool1',
              description: 'description1',
              responseFormat: 'content',
              schema: {},
            } as Tool,
          }),
        ];
        const remoteTools = new RemoteTools(apiKeys, tools);
        expect(remoteTools.tools.length).toEqual(2);
        expect(remoteTools.tools[0].base.name).toEqual('tool1');
      });
    });
  });

  describe('toolDefinitionsForFrontend', () => {
    it('should return the tools with extended definitions', () => {
      const remoteTools = new RemoteTools(apiKeys);
      expect(remoteTools.toolDefinitionsForFrontend).toEqual([
        {
          name: remoteTools.tools[0].sanitizedName,
          description: remoteTools.tools[0].base.description,
          responseFormat: 'content',
          schema: toJsonSchema(remoteTools.tools[0].base.schema as JSONSchema),
          sourceId: remoteTools.tools[0].sourceId,
          sourceType: remoteTools.tools[0].sourceType,
        },
      ]);
    });
  });

  describe('invokeTool', () => {
    it('should call invokeTool', async () => {
      const remoteTools = new RemoteTools(apiKeys);
      remoteTools.invokeTool = jest.fn().mockResolvedValue('response');

      const response = await remoteTools.invokeTool('tool-name', []);

      expect(response).toEqual('response');
    });

    describe('when the tool is not found', () => {
      it('should throw an error', async () => {
        const remoteTools = new RemoteTools(apiKeys);

        await expect(() => remoteTools.invokeTool('not-found', [])).rejects.toThrow(
          'Tool not-found not found',
        );
      });
    });

    describe('when the tool throws an error', () => {
      it('should throw an error', async () => {
        const remoteTools = new RemoteTools(apiKeys);
        remoteTools.tools[0].base.invoke = jest.fn().mockRejectedValue(new Error('error'));

        await expect(() =>
          remoteTools.invokeTool(remoteTools.tools[0].base.name, []),
        ).rejects.toThrow(`Error while calling tool ${remoteTools.tools[0].base.name}: error`);
      });
    });

    describe('when the tool name is sanitized', () => {
      it('should find the right tool to invoke', async () => {
        const remoteTools = new RemoteTools(apiKeys);

        remoteTools.tools[0].base.name = 'brave search';
        remoteTools.tools[0].base.invoke = jest.fn().mockResolvedValue('response');

        await remoteTools.invokeTool(remoteTools.tools[0].sanitizedName, []);

        expect(remoteTools.tools[0].base.invoke).toHaveBeenCalledWith([]);
      });
    });
  });
});
