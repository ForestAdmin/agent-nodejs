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
 * Compatible with both Zod v3 and v4.
 */
function formatZodError(error: z.ZodError): string {
  // Zod v3 uses .errors, v4 uses .issues
  const issues = 'issues' in error ? error.issues : (error as { errors?: z.ZodIssue[] }).errors;

  if (!issues || !Array.isArray(issues)) {
    return error.message || 'Validation failed';
  }

  return issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
}

/**
 * Registers a tool with automatic error logging.
 *
 * This helper ensures that both validation errors and execution errors
 * are logged server-side for debugging purposes.
 *
 * - Validation errors: Pre-validates arguments and logs any Zod validation failures
 * - Execution errors: Wraps the handler to catch and log thrown errors
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
      // Pre-validate arguments to log validation errors
      // We only log here - the SDK will do the actual validation and return errors to client
      const validationResult = schema.safeParse(args);

      if (!validationResult.success) {
        const errorMessage = formatZodError(validationResult.error);
        logger('Error', `[MCP] Tool "${toolName}" validation error: ${errorMessage}`);
      }

      try {
        // Pass original args (not validated.data) to preserve original behavior
        const result = await handler(args as TArgs, extra);

        // Log if the tool returned an error result
        if (result?.isError) {
          const errorText = result.content?.[0]?.text || 'Unknown error';
          logger('Error', `[MCP] Tool "${toolName}" returned error: ${errorText}`);
        }

        return result;
      } catch (error) {
        // Log the error before re-throwing
        const errMessage = error instanceof Error ? error.message : String(error);
        logger('Error', `[MCP] Tool "${toolName}" execution error: ${errMessage}`);
        throw error;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  );
}
