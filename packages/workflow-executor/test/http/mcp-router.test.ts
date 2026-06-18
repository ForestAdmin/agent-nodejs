import type { AiModelPort } from '../../src/ports/ai-model-port';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type Runner from '../../src/runner';
import type { RemoteTool, ToolConfig } from '@forestadmin/ai-proxy';

import jsonwebtoken from 'jsonwebtoken';
import request from 'supertest';
import { z } from 'zod';

import ExecutorHttpServer from '../../src/http/executor-http-server';

const AUTH_SECRET = 'test-auth-secret';
const VERSION = '9.9.9';

function signToken(payload: object): string {
  return jsonwebtoken.sign(payload, AUTH_SECRET, { expiresIn: '1h' });
}

function makeTool(name: string, mcpServerId: string): RemoteTool {
  return {
    base: { name, schema: z.object({ q: z.string() }), invoke: jest.fn().mockResolvedValue('ok') },
    sourceId: mcpServerId,
    sourceType: 'mcp-server',
    mcpServerId,
    sanitizedName: name,
  } as unknown as RemoteTool;
}

function createServer(
  overrides: { configs?: Record<string, ToolConfig>; tools?: RemoteTool[] } = {},
): ExecutorHttpServer {
  const runner = { state: 'running' } as unknown as Runner;
  const workflowPort = {
    getMcpServerConfigs: jest.fn().mockResolvedValue(overrides.configs ?? {}),
  } as unknown as WorkflowPort;
  const aiModelPort = {
    loadRemoteTools: jest.fn().mockResolvedValue(overrides.tools ?? []),
  } as unknown as AiModelPort;

  return new ExecutorHttpServer({
    port: 0,
    runner,
    authSecret: AUTH_SECRET,
    workflowPort,
    aiModelPort,
    executorVersion: VERSION,
    logger: jest.fn(),
  });
}

describe('mcp-router', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const server = createServer();

    const response = await request(server.callback).post('/mcp/list-tools').send({});

    expect(response.status).toBe(401);
  });

  it('stamps the executor version header on /mcp responses', async () => {
    const server = createServer();

    const response = await request(server.callback)
      .post('/mcp/list-tools')
      .set('Authorization', `Bearer ${signToken({ id: 1 })}`)
      .send({});

    expect(response.headers['x-forest-executor-version']).toBe(VERSION);
  });

  it('returns namespaced tools from list-tools', async () => {
    const server = createServer({
      configs: { stripe: { id: 'stripe' } as unknown as ToolConfig },
      tools: [makeTool('users.list', 'stripe')],
    });

    const response = await request(server.callback)
      .post('/mcp/list-tools')
      .set('Authorization', `Bearer ${signToken({ id: 1 })}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.tools[0]).toEqual(
      expect.objectContaining({ name: 'stripe.users.list', mcpServerId: 'stripe' }),
    );
  });

  it('maps McpNeedsConsentError to 403 on execute-tool', async () => {
    const server = createServer({
      configs: { stripe: { id: 'stripe' } as unknown as ToolConfig },
      tools: [],
    });

    const response = await request(server.callback)
      .post('/mcp/execute-tool')
      .set('Authorization', `Bearer ${signToken({ id: 1 })}`)
      .send({ mcpServerId: 'stripe', toolName: 'refunds.create', args: {} });

    expect(response.status).toBe(403);
  });

  it('returns 400 on a malformed execute-tool body', async () => {
    const server = createServer();

    const response = await request(server.callback)
      .post('/mcp/execute-tool')
      .set('Authorization', `Bearer ${signToken({ id: 1 })}`)
      .send({ mcpServerId: 'stripe' });

    expect(response.status).toBe(400);
  });

  it('returns a verdict per operation from can-execute', async () => {
    const server = createServer();

    const response = await request(server.callback)
      .post('/mcp/can-execute')
      .set('Authorization', `Bearer ${signToken({ id: 1 })}`)
      .send([
        { kind: 'list' },
        { kind: 'tool', mcpServerId: 'stripe', toolName: 'refunds.create' },
      ]);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toEqual(expect.objectContaining({ allowed: true }));
  });
});
