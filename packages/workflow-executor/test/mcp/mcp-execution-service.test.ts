import type { AiModelPort } from '../../src/ports/ai-model-port';
import type { Logger } from '../../src/ports/logger-port';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type { RemoteTool, ToolConfig } from '@forestadmin/ai-proxy';

import { z } from 'zod';

import {
  McpNeedsConsentError,
  McpServerUnavailableError,
  McpUnknownToolError,
} from '../../src/mcp/errors';
import McpExecutionService from '../../src/mcp/mcp-execution-service';
import PendingMcpPermissionResolver from '../../src/mcp/mcp-permission-resolver';

function makeTool(options: { name: string; mcpServerId: string; invoke?: jest.Mock }): RemoteTool {
  const { name, mcpServerId, invoke } = options;

  return {
    base: {
      name,
      schema: z.object({ q: z.string() }),
      invoke: invoke ?? jest.fn().mockResolvedValue('ok'),
    },
    sourceId: mcpServerId,
    sourceType: 'mcp-server',
    mcpServerId,
    sanitizedName: name.replace(/[^a-zA-Z0-9_-]/g, '_'),
  } as unknown as RemoteTool;
}

function makeConfigs(...ids: string[]): Record<string, ToolConfig> {
  return Object.fromEntries(ids.map(id => [id, { id } as unknown as ToolConfig]));
}

function makeService(options: { configs?: Record<string, ToolConfig>; tools?: RemoteTool[] }) {
  const getMcpServerConfigs = jest.fn().mockResolvedValue(options.configs ?? {});
  const loadRemoteTools = jest.fn().mockResolvedValue(options.tools ?? []);

  const service = new McpExecutionService({
    workflowPort: { getMcpServerConfigs } as unknown as WorkflowPort,
    aiModelPort: { loadRemoteTools } as unknown as AiModelPort,
    permissionResolver: new PendingMcpPermissionResolver(),
    logger: jest.fn() as unknown as Logger,
  });

  return { service, getMcpServerConfigs, loadRemoteTools };
}

describe('McpExecutionService', () => {
  describe('listTools', () => {
    it('namespaces each tool by joining its server id and tool name, with its schema', async () => {
      const { service } = makeService({
        configs: makeConfigs('stripe'),
        tools: [makeTool({ name: 'users.list', mcpServerId: 'stripe' })],
      });

      const { tools } = await service.listTools(1);

      expect(tools).toEqual([
        {
          name: 'stripe.users.list',
          mcpServerId: 'stripe',
          inputSchema: expect.objectContaining({ type: 'object' }),
        },
      ]);
    });

    it('reports a configured server that produced no tools as needs-consent, without throwing', async () => {
      const { service } = makeService({
        configs: makeConfigs('stripe', 'zendesk'),
        tools: [makeTool({ name: 'users.list', mcpServerId: 'stripe' })],
      });

      const { tools, serverErrors } = await service.listTools(1);

      expect(tools).toHaveLength(1);
      expect(serverErrors).toEqual([{ mcpServerId: 'zendesk', reason: 'needs-consent' }]);
    });

    it('scopes discovery to the requested mcpServerIds', async () => {
      const { service, loadRemoteTools } = makeService({
        configs: makeConfigs('stripe', 'zendesk'),
        tools: [],
      });

      await service.listTools(1, ['zendesk']);

      expect(loadRemoteTools).toHaveBeenCalledWith({ zendesk: { id: 'zendesk' } });
    });
  });

  describe('executeTool', () => {
    it('invokes the matching tool with the given args and returns its result', async () => {
      const invoke = jest.fn().mockResolvedValue({ refunded: true });
      const { service } = makeService({
        configs: makeConfigs('stripe'),
        tools: [makeTool({ name: 'refunds.create', mcpServerId: 'stripe', invoke })],
      });

      const result = await service.executeTool(1, {
        mcpServerId: 'stripe',
        toolName: 'refunds.create',
        args: { payment_intent: 'pi_99' },
      });

      expect(invoke).toHaveBeenCalledWith({ payment_intent: 'pi_99' });
      expect(result).toEqual({ refunded: true });
    });

    it('throws McpUnknownToolError when the server is not configured', async () => {
      const { service } = makeService({ configs: makeConfigs('stripe') });

      await expect(
        service.executeTool(1, { mcpServerId: 'zendesk', toolName: 'x', args: {} }),
      ).rejects.toBeInstanceOf(McpUnknownToolError);
    });

    it('throws McpNeedsConsentError when the configured server loads no tools', async () => {
      const { service } = makeService({ configs: makeConfigs('stripe'), tools: [] });

      await expect(
        service.executeTool(1, { mcpServerId: 'stripe', toolName: 'x', args: {} }),
      ).rejects.toBeInstanceOf(McpNeedsConsentError);
    });

    it('throws McpUnknownToolError when the tool name does not match', async () => {
      const { service } = makeService({
        configs: makeConfigs('stripe'),
        tools: [makeTool({ name: 'refunds.create', mcpServerId: 'stripe' })],
      });

      await expect(
        service.executeTool(1, { mcpServerId: 'stripe', toolName: 'nope', args: {} }),
      ).rejects.toBeInstanceOf(McpUnknownToolError);
    });

    it('wraps an upstream invocation failure as McpServerUnavailableError', async () => {
      const invoke = jest.fn().mockRejectedValue(new Error('upstream 500'));
      const { service } = makeService({
        configs: makeConfigs('stripe'),
        tools: [makeTool({ name: 'refunds.create', mcpServerId: 'stripe', invoke })],
      });

      await expect(
        service.executeTool(1, { mcpServerId: 'stripe', toolName: 'refunds.create', args: {} }),
      ).rejects.toBeInstanceOf(McpServerUnavailableError);
    });
  });

  describe('canExecute', () => {
    it('returns one verdict per operation for an array', async () => {
      const { service } = makeService({});

      const verdicts = await service.canExecute(1, [
        { kind: 'list' },
        { kind: 'tool', mcpServerId: 'stripe', toolName: 'refunds.create' },
      ]);

      expect(verdicts).toEqual([
        { allowed: true, reason: 'permission-resolution-pending' },
        { allowed: true, reason: 'permission-resolution-pending' },
      ]);
    });

    it('normalizes a single operation into a one-element array', async () => {
      const { service } = makeService({});

      const verdicts = await service.canExecute(1, { kind: 'list' });

      expect(verdicts).toHaveLength(1);
    });
  });
});
