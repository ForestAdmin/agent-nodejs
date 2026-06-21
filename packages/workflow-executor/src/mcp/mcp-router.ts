import type McpExecutionService from './mcp-execution-service';
import type { BearerClaims } from '../http/bearer-claims';

import Router from '@koa/router';
import { z } from 'zod';

import { BadRequestHttpError } from '../http/http-errors';

const listToolsBodySchema = z.object({ mcpServerIds: z.array(z.string()).optional() });

const executeToolBodySchema = z.object({
  mcpServerId: z.string().min(1),
  toolName: z.string().min(1),
  args: z.unknown(),
});

const operationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('list') }),
  z.object({
    kind: z.literal('tool'),
    mcpServerId: z.string().min(1),
    toolName: z.string().min(1),
  }),
]);

const canExecuteBodySchema = z.union([operationSchema, z.array(operationSchema)]);

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new BadRequestHttpError(
      `Invalid request body: ${result.error.issues.map(issue => issue.message).join(', ')}`,
    );
  }

  return result.data;
}

// Dedicated /mcp/* route group (PRD-514) — stateless, decoupled from /runs. Mounted on the same Koa
// app so it inherits auth + error-translation; references only McpExecutionService (no runner).
export default function buildMcpRouter(options: {
  service: McpExecutionService;
  executorVersion: string;
}): Router {
  const { service, executorVersion } = options;
  const router = new Router();

  // Stamp the executor version on every /mcp/* response so the gateway can gate on divergence
  // without an extra round-trip.
  router.use(async (ctx, next) => {
    ctx.set('X-Forest-Executor-Version', executorVersion);
    await next();
  });

  router.post('/mcp/list-tools', async ctx => {
    const userId = (ctx.state.user as BearerClaims).id;
    const { mcpServerIds } = parseBody(listToolsBodySchema, ctx.request.body);
    ctx.body = await service.listTools(userId, mcpServerIds);
  });

  router.post('/mcp/execute-tool', async ctx => {
    const userId = (ctx.state.user as BearerClaims).id;
    const req = parseBody(executeToolBodySchema, ctx.request.body);
    ctx.body = await service.executeTool(userId, req);
  });

  router.post('/mcp/can-execute', async ctx => {
    const userId = (ctx.state.user as BearerClaims).id;
    const operations = parseBody(canExecuteBodySchema, ctx.request.body);
    ctx.body = await service.canExecute(userId, operations);
  });

  return router;
}
