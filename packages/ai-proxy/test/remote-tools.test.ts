import type { Tool } from '@langchain/core/tools';
import type { JSONSchema } from '@langchain/core/utils/json_schema';

import { toJsonSchema } from '@langchain/core/utils/json_schema';

import { RemoteTools } from '../src';
import ServerRemoteTool from '../src/server-remote-tool';

function createMockTool(
  name = 'tool1',
  description = 'description1',
  sourceId?: string,
): ServerRemoteTool {
  return new ServerRemoteTool({
    sourceId,
    tool: {
      name,
      description,
      responseFormat: 'content',
      schema: {},
    } as Tool,
  });
}

describe('RemoteTools', () => {
  describe('constructor', () => {
    it('should have no tools when constructed without arguments', () => {
      const remoteTools = new RemoteTools();
      expect(remoteTools.tools).toEqual([]);
    });

    it('should store provided tools', () => {
      const tools = [createMockTool()];
      const remoteTools = new RemoteTools(tools);
      expect(remoteTools.tools).toHaveLength(1);
      expect(remoteTools.tools[0].base.name).toEqual('tool1');
    });
  });

  describe('toolDefinitionsForFrontend', () => {
    it('should return the tools with extended definitions', () => {
      const tool = createMockTool();
      const remoteTools = new RemoteTools([tool]);

      expect(remoteTools.toolDefinitionsForFrontend).toEqual([
        {
          name: tool.sanitizedName,
          description: tool.base.description,
          responseFormat: 'content',
          schema: toJsonSchema(tool.base.schema as JSONSchema),
          sourceId: tool.sourceId,
          sourceType: tool.sourceType,
        },
      ]);
    });
  });

  describe('invokeTool', () => {
    it('should invoke the tool and return its response', async () => {
      const tool = createMockTool();
      tool.base.invoke = jest.fn().mockResolvedValue('response');
      const remoteTools = new RemoteTools([tool]);

      const response = await remoteTools.invokeTool(tool.sanitizedName, []);

      expect(response).toEqual('response');
      expect(tool.base.invoke).toHaveBeenCalledWith([]);
    });

    it('should throw when the tool is not found', async () => {
      const remoteTools = new RemoteTools();

      await expect(() => remoteTools.invokeTool('not-found', [])).rejects.toThrow(
        'Tool not-found not found',
      );
    });

    it('should wrap tool errors with tool name', async () => {
      const tool = createMockTool();
      tool.base.invoke = jest.fn().mockRejectedValue(new Error('error'));
      const remoteTools = new RemoteTools([tool]);

      await expect(() => remoteTools.invokeTool(tool.sanitizedName, [])).rejects.toThrow(
        `Error while calling tool ${tool.base.name}: error`,
      );
    });

    it('should find tool by sanitized name', async () => {
      const tool = createMockTool('brave search');
      tool.base.invoke = jest.fn().mockResolvedValue('response');
      const remoteTools = new RemoteTools([tool]);

      await remoteTools.invokeTool(tool.sanitizedName, []);

      expect(tool.base.invoke).toHaveBeenCalledWith([]);
    });

    describe('when multiple tools have the same name', () => {
      it('should throw when no sourceId is provided', async () => {
        const tool1 = createMockTool('send_message', 'desc', 'slack');
        const tool2 = createMockTool('send_message', 'desc', 'linear');
        const remoteTools = new RemoteTools([tool1, tool2]);

        await expect(() => remoteTools.invokeTool('send_message', [])).rejects.toThrow(
          'Multiple tools found with name "send_message" (sources: slack, linear). Provide a source-id to disambiguate.',
        );
      });

      it('should throw not-found when sourceId does not match any tool', async () => {
        const tool1 = createMockTool('send_message', 'desc', 'slack');
        const tool2 = createMockTool('send_message', 'desc', 'linear');
        const remoteTools = new RemoteTools([tool1, tool2]);

        await expect(() => remoteTools.invokeTool('send_message', [], 'teams')).rejects.toThrow(
          'Tool send_message not found',
        );
      });

      it('should invoke the correct tool when sourceId is provided', async () => {
        const tool1 = createMockTool('send_message', 'desc', 'slack');
        tool1.base.invoke = jest.fn().mockResolvedValue('slack response');
        const tool2 = createMockTool('send_message', 'desc', 'linear');
        tool2.base.invoke = jest.fn().mockResolvedValue('linear response');
        const remoteTools = new RemoteTools([tool1, tool2]);

        const response = await remoteTools.invokeTool('send_message', [], 'linear');

        expect(response).toEqual('linear response');
        expect(tool1.base.invoke).not.toHaveBeenCalled();
        expect(tool2.base.invoke).toHaveBeenCalledWith([]);
      });
    });
  });
});
