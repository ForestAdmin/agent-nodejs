import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

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

/**
 * Formats a Zod error into a readable string.
 */
function formatZodError(error: z.ZodError): string {
  return error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
}

/**
 * Registers a tool with validation error logging.
 *
 * This helper pre-validates arguments and logs validation failures with detailed
 * field information. Execution errors and error results are logged by the SSE
 * interception in server.ts, so we don't duplicate that logging here.
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
): void {
  const schema = z.object(config.inputSchema);

  mcpServer.registerTool(
    toolName,
    config,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (async (args: any, extra: any) => {
      // Pre-validate arguments to log validation errors with field details
      // The SDK will do the actual validation and return errors to client
      const validationResult = schema.safeParse(args);

      if (!validationResult.success) {
        const errorMessage = formatZodError(validationResult.error);
        logger('Error', `[MCP] Tool "${toolName}" validation error: ${errorMessage}`);
      }

      // Execution errors are caught and logged by SSE interception in server.ts
      return handler(args as TArgs, extra);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  );
}
