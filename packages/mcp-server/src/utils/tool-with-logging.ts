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

// The MCP SDK bundles its own zod copy, creating nominally different types.
// This type bridge extracts what registerTool() actually expects.
type RegisterToolConfig = Parameters<McpServer['registerTool']>[1];

type ToolHandlerExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

// -----------------------------------------------------------------------------
// Validation Helpers
// -----------------------------------------------------------------------------

/**
 * Formats a Zod error into a human-readable string.
 * Example: "collectionName: Required, sort.field: Expected string"
 */
function formatZodError(error: z.ZodError): string {
  return error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
}

/**
 * Validates arguments against a schema and logs errors if validation fails.
 * This is a pre-validation step for logging purposes only - the SDK handles actual validation.
 */
function logValidationErrorsIfAny(
  args: unknown,
  schema: z.ZodSchema,
  toolName: string,
  logger: Logger,
): void {
  const result = schema.safeParse(args);

  if (!result.success) {
    const errorMessage = formatZodError(result.error);
    logger('Error', `Tool "${toolName}" validation error: ${errorMessage}`);
  }
}

// -----------------------------------------------------------------------------
// Tool Registration
// -----------------------------------------------------------------------------

/**
 * Registers an MCP tool with automatic validation error logging.
 *
 * This wrapper logs validation errors with detailed field information,
 * which helps debug tool calls when clients send invalid arguments.
 *
 * Note: Execution errors are caught and converted to { isError: true } tool results.
 * The SSE response interceptor in server.ts additionally logs these errors from the stream.
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
  logger: Logger,
): string {
  const schema = z.object(config.inputSchema);

  mcpServer.registerTool(
    toolName,
    config as RegisterToolConfig,
    async (args: Record<string, unknown>, extra: ToolHandlerExtra) => {
      logValidationErrorsIfAny(args, schema, toolName, logger);

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
