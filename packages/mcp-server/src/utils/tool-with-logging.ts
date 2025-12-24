import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

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

type ToolResult = {
  content: { type: string; text: string }[];
  isError?: boolean;
};

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
    logger('Error', `[MCP] Tool "${toolName}" validation error: ${errorMessage}`);
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
 * Note: Execution errors are logged by the SSE response interceptor in server.ts,
 * so we don't duplicate that logging here.
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: TArgs, extra: any) => Promise<ToolResult>,
  logger: Logger,
): string {
  const schema = z.object(config.inputSchema);

  mcpServer.registerTool(
    toolName,
    config,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (async (args: any, extra: any) => {
      logValidationErrorsIfAny(args, schema, toolName, logger);

      return handler(args as TArgs, extra);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  );

  return toolName;
}
