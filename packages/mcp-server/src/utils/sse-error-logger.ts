import type { Logger } from '../server';
import type { Response } from 'express';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface McpJsonRpcResponse {
  result?: {
    isError?: boolean;
    content?: Array<{ text?: string }>;
  };
  error?: {
    message?: string;
  };
}

// -----------------------------------------------------------------------------
// Chunk Conversion
// -----------------------------------------------------------------------------

/**
 * Converts various chunk types to a UTF-8 string.
 * Handles Buffer, Uint8Array, and string inputs.
 */
function chunkToString(chunk: Buffer | string | Uint8Array): string {
  if (typeof chunk === 'string') {
    return chunk;
  }

  if (Buffer.isBuffer(chunk)) {
    return chunk.toString('utf8');
  }

  return new TextDecoder('utf8').decode(chunk);
}

// -----------------------------------------------------------------------------
// SSE Parsing
// -----------------------------------------------------------------------------

/**
 * Extracts the JSON payload from an SSE data line.
 * SSE format: "event: message\ndata: {...}\n\n"
 */
function extractJsonFromSseData(data: string): string | null {
  const match = data.match(/data:\s*({.+})/s);

  return match ? match[1] : null;
}

/**
 * Parses SSE data and logs any MCP errors found.
 *
 * MCP errors come in two forms:
 * 1. JSON-RPC errors: { error: { message: "..." } }
 * 2. Tool errors: { result: { isError: true, content: [{ text: "..." }] } }
 */
function parseAndLogMcpErrors(data: string, logger: Logger): void {
  const jsonString = extractJsonFromSseData(data);

  if (!jsonString) {
    return;
  }

  let parsed: McpJsonRpcResponse;

  try {
    parsed = JSON.parse(jsonString) as McpJsonRpcResponse;
  } catch (error) {
    // SyntaxError is expected for non-JSON SSE events (like "ping")
    if (!(error instanceof SyntaxError)) {
      logger('Warn', `Failed to parse SSE response: ${error}`);
    }

    return;
  }

  // Log JSON-RPC level errors
  if (parsed.error?.message) {
    logger('Error', `${parsed.error.message}`);
  }

  // Log tool execution errors (isError: true in result)
  if (parsed.result?.isError) {
    const errorText = parsed.result.content?.[0]?.text || 'Unknown error';
    logger('Error', `Tool error: ${errorText}`);
  }
}

// -----------------------------------------------------------------------------
// Response Chunk Logging
// -----------------------------------------------------------------------------

/**
 * Safely attempts to log errors from a response chunk.
 * Never throws - logging failures should not affect the response.
 */
function logChunkErrors(
  chunk: Buffer | string | Uint8Array | null | undefined,
  logger: Logger,
): void {
  if (chunk == null) {
    return;
  }

  try {
    const data = chunkToString(chunk);
    parseAndLogMcpErrors(data, logger);
  } catch (error) {
    logger('Warn', `Failed to parse response for error logging: ${error}`);
  }
}

// -----------------------------------------------------------------------------
// Response Interceptor
// -----------------------------------------------------------------------------

/**
 * Wraps an Express response to intercept and log MCP errors from SSE streams.
 *
 * Why we need this:
 * The MCP SDK sends errors as SSE events, not HTTP errors. To log these errors
 * server-side, we intercept the response stream and parse each chunk for errors.
 *
 * This function modifies res.write() and res.end() to add logging without
 * affecting the actual response sent to the client.
 */
/**
 * Logs the collected response body when the HTTP status code indicates a server error.
 * This catches cases where the MCP SDK writes a 500 response directly (e.g. plain JSON)
 * without going through the SSE error format.
 */
function logHttpErrorBody(chunks: string[], res: Response, logger: Logger): void {
  if (res.statusCode < 500) {
    return;
  }

  const body = chunks.join('');

  if (!body) {
    return;
  }

  logger('Error', `HTTP ${res.statusCode} response body: ${body}`);
}

export default function interceptResponseForErrorLogging(res: Response, logger: Logger): void {
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  const chunks: string[] = [];

  // Intercept streaming chunks (res.write)
  res.write = function interceptedWrite(
    chunk: Buffer | string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ): boolean {
    logChunkErrors(chunk, logger);

    try {
      chunks.push(chunkToString(chunk));
    } catch {
      // Never affect the response
    }

    return originalWrite(chunk, encodingOrCallback as BufferEncoding, callback);
  } as typeof res.write;

  // Intercept final chunk (res.end)
  res.end = function interceptedEnd(
    chunk?: Buffer | string | Uint8Array | (() => void),
    encodingOrCallback?: BufferEncoding | (() => void),
    callback?: () => void,
  ): typeof res {
    if (chunk && typeof chunk !== 'function') {
      logChunkErrors(chunk as Buffer | string | Uint8Array, logger);

      try {
        chunks.push(chunkToString(chunk as Buffer | string | Uint8Array));
      } catch {
        // Never affect the response
      }
    }

    const result = originalEnd(chunk, encodingOrCallback as BufferEncoding, callback);

    try {
      logHttpErrorBody(chunks, res, logger);
    } catch {
      // Never affect the response
    }

    return result;
  } as typeof res.end;
}
