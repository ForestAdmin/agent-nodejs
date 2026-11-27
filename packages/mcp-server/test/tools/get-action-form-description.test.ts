import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { HttpError, NotFoundError } from '@forestadmin/forestadmin-client/dist/utils/errors';

import declareGetActionFormTool from '../../src/tools/get-action-form';
import { buildClientWithActions } from '../../src/utils/agent-caller';
import * as schemaFetcher from '../../src/utils/schema-fetcher';
import createMockForestServerClient from '../helpers/forest-server-client';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/schema-fetcher');

type ToolResult = { content: { text: string }[]; isError?: boolean };

describe('getActionForm serves the description of the action', () => {
  const logger: Logger = jest.fn();
  let forestServerClient: jest.Mocked<ForestServerClient>;
  let handler: (options: unknown, extra: unknown) => Promise<ToolResult>;

  const extra = (authExtra: Record<string, unknown> = {}) =>
    ({
      authInfo: {
        token: 'mcp-token',
        extra: {
          forestServerToken: 'forest-token',
          renderingId: 456,
          environmentId: 12345,
          ...authExtra,
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>);

  const call = async (authExtra?: Record<string, unknown>) => {
    const result = await handler(
      { collectionName: 'orders', actionName: 'Refund all', recordIds: [1] },
      extra(authExtra),
    );

    return JSON.parse(result.content[0].text);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    forestServerClient = createMockForestServerClient({
      getSemanticLayerActionDescription: jest
        .fn()
        .mockResolvedValue({ hasVersion: true, text: 'Refunds every item of the order' }),
    });

    (buildClientWithActions as jest.Mock).mockResolvedValue({
      rpcClient: {
        collection: jest.fn().mockReturnValue({
          action: jest.fn().mockResolvedValue({
            getFields: jest.fn().mockReturnValue([]),
            tryToSetFields: jest.fn().mockResolvedValue([]),
            describeForm: jest.fn().mockReturnValue({
              fields: [],
              requiredFields: [],
              invalidValues: [],
              canExecute: true,
            }),
          }),
        }),
      },
    });
    (schemaFetcher.fetchForestSchema as jest.Mock).mockResolvedValue({
      collections: [
        {
          name: 'orders',
          actions: [
            { name: 'Archive', description: 'Archive (code)' },
            { name: 'Refund all', description: 'Refund all (code)' },
          ],
        },
      ],
    });

    const mcpServer = {
      registerTool: jest.fn((_name, _config, toolHandler) => {
        handler = toolHandler;
      }),
    } as unknown as McpServer;

    declareGetActionFormTool(mcpServer, { forestServerClient, logger, collectionNames: [] });
  });

  it('reads the description of the action with the caller token and environment', async () => {
    await call();

    expect(forestServerClient.getSemanticLayerActionDescription).toHaveBeenCalledWith({
      forestServerToken: 'forest-token',
      environmentId: 12345,
      collectionName: 'orders',
      actionName: 'Refund all',
    });
  });

  it("returns Forest's text when Forest describes the action", async () => {
    const body = await call();

    expect(body.description).toBe('Refunds every item of the order');
  });

  it('returns the code description when Forest never described the action', async () => {
    forestServerClient.getSemanticLayerActionDescription.mockResolvedValue({
      hasVersion: false,
      text: null,
    });

    const body = await call();

    expect(body.description).toBe('Refund all (code)');
  });

  it('returns no description once the Forest description was removed', async () => {
    forestServerClient.getSemanticLayerActionDescription.mockResolvedValue({
      hasVersion: true,
      text: null,
    });

    const body = await call();

    expect(body).not.toHaveProperty('description');
  });

  it("returns no description when Forest says the caller's role cannot reach the action", async () => {
    forestServerClient.getSemanticLayerActionDescription.mockRejectedValue(
      new NotFoundError('Element not found'),
    );

    const body = await call();

    expect(body).not.toHaveProperty('description');
    expect(body.canExecute).toBe(true);
  });

  it('returns the code description when Forest cannot answer', async () => {
    forestServerClient.getSemanticLayerActionDescription.mockRejectedValue(
      new HttpError('boom', 500),
    );

    const body = await call();

    expect(body.description).toBe('Refund all (code)');
  });

  it('returns the code description without calling Forest when the environment is unknown', async () => {
    const body = await call({ environmentId: undefined });

    expect(forestServerClient.getSemanticLayerActionDescription).not.toHaveBeenCalled();
    expect(body.description).toBe('Refund all (code)');
  });
});
