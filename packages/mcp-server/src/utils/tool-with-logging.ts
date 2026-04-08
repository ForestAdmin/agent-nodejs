import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';

import { z } from 'zod';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ZodRawShape = Record<string, z.ZodTypeAny>;

interface ToolConfig<TSchema extends ZodRawShape> {
  title: string;
  description: string;
  inputSchema: TSchema;
}

type RegisterToolConfig = Parameters<McpServer['registerTool']>[1];

type ToolHandlerExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

// -----------------------------------------------------------------------------
// Tool Registration
// -----------------------------------------------------------------------------

/**
 * Registers an MCP tool with strict input validation.
 *
 * Uses Zod's `.strict()` mode so the SDK rejects unknown keys instead of
 * silently stripping them. This prevents hard-to-debug issues where a typo
 * (e.g. "filter" instead of "filters") causes the tool to run without the
 * intended parameter.
 *
 * Execution errors are caught and converted to { isError: true } tool results.
 *
 * @example
 * registerToolWithLogging(
 *   mcpServer,
 *   'list',
 *   {
 *     title: 'List Records',
 *     description: 'Lists records from a collection',
 *     inputSchema: { collectionName: z.string() },
 *   },
 *   async (args) => {
 *     const records = await fetchRecords(args.collectionName);
 *     return { content: [{ type: 'text', text: JSON.stringify(records) }] };
 *   },
 *   logger,
 * );
 */
export default function registerToolWithLogging<
  TSchema extends ZodRawShape,
  TArgs = z.infer<z.ZodObject<TSchema>>,
>(
  mcpServer: McpServer,
  toolName: string,
  config: ToolConfig<TSchema>,
  handler: (args: TArgs, extra: ToolHandlerExtra) => Promise<CallToolResult>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  logger: Logger,
): string {
  const strictSchema = z.object(config.inputSchema).strict();

  mcpServer.registerTool(
    toolName,
    { ...config, inputSchema: strictSchema } as RegisterToolConfig,
    async (args: Record<string, unknown>, extra: ToolHandlerExtra) => {
      // Return errors as tool results (isError: true) instead of throwing.
      // Per MCP spec, tool errors should be reported within the result object,
      // not as protocol-level errors, so the LLM can see and handle them.
      // See: https://modelcontextprotocol.io/docs/concepts/tools
      try {
        return await handler(args as TArgs, extra);
      } catch (error) {
        let message: string;

        try {
          message = error instanceof Error ? error.message : JSON.stringify(error) ?? String(error);
        } catch {
          message = String(error);
        }

        return {
          content: [{ type: 'text' as const, text: message }],
          isError: true,
        };
      }
    },
  );

  return toolName;
}
