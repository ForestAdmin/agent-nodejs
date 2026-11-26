import type { ForestServerClient, SemanticLayerDescription } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { HttpError, NotFoundError } from '@forestadmin/forestadmin-client/dist/utils/errors';

import declareDescribeCollectionTool from '../../src/tools/describe-collection';
import buildClient from '../../src/utils/agent-caller';
import * as schemaFetcher from '../../src/utils/schema-fetcher';
import createMockForestServerClient from '../helpers/forest-server-client';

jest.mock('../../src/utils/agent-caller');
jest.mock('@forestadmin/agent-client', () => ({
  ...jest.requireActual('@forestadmin/agent-client'),
  withActivityLog: jest.fn((_config, _entry, operation) => operation()),
}));
jest.mock('../../src/utils/schema-fetcher');

const described = (text: string): SemanticLayerDescription => ({ hasVersion: true, text });
const neverDescribed: SemanticLayerDescription = { hasVersion: false, text: null };
const removed: SemanticLayerDescription = { hasVersion: true, text: null };

type ToolResult = { content: { text: string }[]; isError?: boolean };

describe('describeCollection serves the descriptions written in Forest', () => {
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

  const call = async (collectionName = 'orders', authExtra?: Record<string, unknown>) => {
    const result = await handler({ collectionName }, extra(authExtra));

    return { result, body: result.isError ? null : JSON.parse(result.content[0].text) };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    forestServerClient = createMockForestServerClient({
      getSemanticLayerCollection: jest.fn().mockResolvedValue({
        collection: described('Customer orders'),
        fields: {
          id: neverDescribed,
          status: described('Where the order is in its life'),
          customer: described('Who placed it'),
        },
        actions: {
          Refund: described('Refunds the order in full'),
          Archive: neverDescribed,
          Cancel: removed,
        },
        workflows: [
          { id: 'wf-1', name: 'Refund order', description: described('Refund then notify') },
          { id: 'wf-2', name: 'Not MCP enabled', description: described('Hidden from MCP') },
          { id: 'wf-3', name: 'Escalate', description: neverDescribed },
        ],
      }),
      listMcpEnabledWorkflows: jest.fn().mockResolvedValue([
        { workflowId: 'wf-1', name: 'Refund order', collectionName: 'orders' },
        { workflowId: 'wf-3', name: 'Escalate', collectionName: 'orders' },
      ]),
    });

    (buildClient as jest.Mock).mockReturnValue({
      rpcClient: {
        collection: jest.fn().mockReturnValue({
          capabilities: jest.fn().mockResolvedValue({
            fields: [
              { name: 'id', type: 'Number', operators: [] },
              { name: 'status', type: 'String', operators: [] },
            ],
          }),
        }),
      },
    });
    (schemaFetcher.fetchForestSchema as jest.Mock).mockResolvedValue({ collections: [] });
    (schemaFetcher.getFieldsOfCollection as jest.Mock).mockReturnValue([
      { field: 'id', type: 'Number', isPrimaryKey: true },
      { field: 'status', type: 'String' },
      { field: 'customer', type: 'Number', relationship: 'BelongsTo', reference: 'customers.id' },
    ]);
    (schemaFetcher.getActionsOfCollection as jest.Mock).mockReturnValue(
      ['Refund', 'Archive', 'Cancel', 'Export'].map(name => ({
        name,
        type: 'single',
        endpoint: `/forest/actions/${name}`,
        description: `${name} (code)`,
        fields: [],
        hooks: { load: false },
        download: false,
      })),
    );

    const mcpServer = {
      registerTool: jest.fn((_name, _config, toolHandler) => {
        handler = toolHandler;
      }),
    } as unknown as McpServer;

    declareDescribeCollectionTool(mcpServer, {
      forestServerClient,
      logger,
      collectionNames: ['orders', 'cards'],
    });
  });

  it('reads the descriptions of the collection with the caller token and environment', async () => {
    await call();

    expect(forestServerClient.getSemanticLayerCollection).toHaveBeenCalledWith({
      forestServerToken: 'forest-token',
      environmentId: 12345,
      collectionName: 'orders',
    });
  });

  it('reads Forest again on every call, so a description written in between is returned', async () => {
    await call();
    forestServerClient.getSemanticLayerCollection.mockResolvedValueOnce({
      collection: described('Rewritten just now'),
      fields: {},
      actions: {},
      workflows: [],
    });

    const { body } = await call();

    expect(forestServerClient.getSemanticLayerCollection).toHaveBeenCalledTimes(2);
    expect(body.description).toBe('Rewritten just now');
  });

  it('returns the description of the collection', async () => {
    const { body } = await call();

    expect(body.description).toBe('Customer orders');
  });

  it('returns the description of each described field and relation, and none for the others', async () => {
    const { body } = await call();

    expect(body.fields).toEqual([
      expect.not.objectContaining({ description: expect.anything() }),
      expect.objectContaining({ name: 'status', description: 'Where the order is in its life' }),
    ]);
    expect(body.fields[0]).not.toHaveProperty('description');
    expect(body.relations).toEqual([
      expect.objectContaining({ name: 'customer', description: 'Who placed it' }),
    ]);
  });

  it("returns Forest's text over the code description of an action Forest describes", async () => {
    const { body } = await call();

    expect(body.actions.find(action => action.name === 'Refund').description).toBe(
      'Refunds the order in full',
    );
  });

  it('returns the code description of an action Forest never described', async () => {
    const { body } = await call();

    expect(body.actions.find(action => action.name === 'Archive').description).toBe(
      'Archive (code)',
    );
  });

  it('returns no description for an action whose Forest description was removed', async () => {
    const { body } = await call();

    expect(body.actions.find(action => action.name === 'Cancel')).not.toHaveProperty('description');
  });

  it("lists an action the caller's role cannot trigger, with no description", async () => {
    const { body } = await call();

    const exported = body.actions.find(action => action.name === 'Export');
    expect(exported).toEqual(expect.objectContaining({ name: 'Export' }));
    expect(exported).not.toHaveProperty('description');
  });

  it('lists only the MCP-enabled workflows of the caller on the collection, with their descriptions', async () => {
    const { body } = await call();

    expect(forestServerClient.listMcpEnabledWorkflows).toHaveBeenCalledWith({
      forestServerToken: 'forest-token',
      renderingId: '456',
      collectionName: 'orders',
    });
    expect(body.workflows).toEqual([
      { id: 'wf-1', name: 'Refund order', description: 'Refund then notify' },
      { id: 'wf-3', name: 'Escalate' },
    ]);
  });

  it('lists no workflow when the MCP-enabled workflows cannot be listed', async () => {
    forestServerClient.listMcpEnabledWorkflows.mockRejectedValue(new HttpError('conflict', 409));

    const { body } = await call();

    expect(body.workflows).toEqual([]);
    expect(body.description).toBe('Customer orders');
  });

  it('answers with the same error as a missing collection when Forest says the caller cannot reach it', async () => {
    (schemaFetcher.getFieldsOfCollection as jest.Mock).mockImplementation((_schema, name) => {
      throw new Error(`Collection "${name}" not found in schema`);
    });
    const missing = await call('ghost');
    (schemaFetcher.getFieldsOfCollection as jest.Mock).mockReturnValue([]);
    forestServerClient.getSemanticLayerCollection.mockRejectedValue(
      new NotFoundError('Element not found'),
    );

    const unreachable = await call('cards');

    expect(unreachable.result.isError).toBe(true);
    expect(unreachable.result.content[0].text).toBe(
      missing.result.content[0].text.replace('ghost', 'cards'),
    );
  });

  describe('when Forest cannot return the descriptions', () => {
    it.each([
      ['answers a server error', new HttpError('boom', 500)],
      ['times out', new HttpError('timed out while trying to reach https://forest', 408)],
      ['refuses the IP address', new HttpError('IP address rejected (1.2.3.4)', 403)],
      ['does not know the route', new NotFoundError('The requested resource was not found')],
    ])('still answers, with the code descriptions, when Forest %s', async (_label, error) => {
      forestServerClient.getSemanticLayerCollection.mockRejectedValue(error);

      const { result, body } = await call();

      expect(result.isError).toBeFalsy();
      expect(body).not.toHaveProperty('description');
      expect(body.fields.find(field => field.name === 'status')).not.toHaveProperty('description');
      expect(body.actions.find(action => action.name === 'Refund').description).toBe(
        'Refund (code)',
      );
      expect(body).toHaveProperty(['_meta', 'descriptionsAvailable'], false);
      expect(JSON.stringify(body)).not.toContain('https://forest');
    });

    it('does not call Forest and says so when the environment is unknown', async () => {
      const { body } = await call('orders', { environmentId: undefined });

      expect(forestServerClient.getSemanticLayerCollection).not.toHaveBeenCalled();
      expect(body).toHaveProperty(['_meta', 'descriptionsAvailable'], false);
      expect(body.actions.find(action => action.name === 'Refund').description).toBe(
        'Refund (code)',
      );
    });
  });

  it('says the descriptions are available when Forest returned them', async () => {
    const { body } = await call();

    expect(body).toHaveProperty(['_meta', 'descriptionsAvailable'], true);
  });
});
