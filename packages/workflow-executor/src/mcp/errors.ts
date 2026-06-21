/* eslint-disable max-classes-per-file */
import { AccessDeniedError, NotFoundError, UnavailableError } from '../errors';

// /mcp/* route errors (PRD-514). They extend the transport-agnostic domain categories, so the
// existing toHttpError maps each to the right status by instanceof — no per-error HTTP binding.
export class McpNeedsConsentError extends AccessDeniedError {
  constructor(mcpServerId: string) {
    super(
      `MCP server "${mcpServerId}" has no usable credential`,
      'This integration is not connected. Connect it in Forest settings, then retry.',
    );
  }
}

export class McpUnknownToolError extends NotFoundError {
  constructor(mcpServerId: string, toolName: string) {
    super(
      `MCP tool "${toolName}" not found on server "${mcpServerId}"`,
      'The requested tool does not exist on this integration.',
    );
  }
}

export class McpServerUnavailableError extends UnavailableError {
  constructor(mcpServerId: string, cause?: unknown) {
    super(
      `MCP server "${mcpServerId}" call failed: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      'The integration is temporarily unavailable. Please try again.',
    );
    this.cause = cause;
  }
}
