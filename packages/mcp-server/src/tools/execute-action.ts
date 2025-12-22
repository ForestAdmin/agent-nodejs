import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

import createActivityLog from '../utils/activity-logs-creator.js';
import buildClient, { ActionEndpointsMap } from '../utils/agent-caller.js';
import parseAgentError from '../utils/error-parser.js';
import registerToolWithLogging from '../utils/tool-with-logging.js';

// Preprocess to handle LLM sending recordIds as JSON string instead of array
const recordIdsWithPreprocess = z.preprocess(val => {
  if (typeof val !== 'string') return val;

  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}, z.array(z.union([z.string(), z.number()])).optional());

// Preprocess to handle LLM sending values as JSON string instead of object
const valuesWithPreprocess = z.preprocess(val => {
  if (typeof val !== 'string') return val;

  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}, z.record(z.string(), z.unknown()).optional());

interface ExecuteActionArgument {
  collectionName: string;
  actionName: string;
  recordIds?: (string | number)[];
  values?: Record<string, unknown>;
}

// File value format accepted from MCP clients
interface FileValue {
  name: string;
  mimeType: string;
  contentBase64: string;
}

function isFileValue(value: unknown): value is FileValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'mimeType' in value &&
    'contentBase64' in value &&
    typeof (value as FileValue).name === 'string' &&
    typeof (value as FileValue).mimeType === 'string' &&
    typeof (value as FileValue).contentBase64 === 'string'
  );
}

function fileToDataUri(file: FileValue): string {
  // Format: data:mimeType;name=filename;base64,content
  const encodedName = encodeURIComponent(file.name);

  return `data:${file.mimeType};name=${encodedName};base64,${file.contentBase64}`;
}

/**
 * Convert file values in the form data to data URI format expected by the agent.
 * Supports both single files and file arrays.
 */
function convertFileValuesToDataUri(values: Record<string, unknown>): Record<string, unknown> {
  const converted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    if (isFileValue(value)) {
      // Single file
      converted[key] = fileToDataUri(value);
    } else if (Array.isArray(value) && value.length > 0 && value.every(isFileValue)) {
      // File array (FileList)
      converted[key] = value.map(fileToDataUri);
    } else {
      converted[key] = value;
    }
  }

  return converted;
}

// Full action result as returned by the agent (agent-client types are too restrictive)
interface ActionResultFromAgent {
  // Success result
  success?: string;
  html?: string;
  refresh?: { relationships: string[] };
  // Error result (returned with HTTP 400, but caught and re-thrown)
  error?: string;
  // Webhook result
  webhook?: {
    url: string;
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body: unknown;
  };
  // Redirect result
  redirectTo?: string;
}

// Maximum file size to return inline (5MB)
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type FormattedResult =
  | {
      type: 'Success';
      message?: string;
      html?: string;
      invalidatedRelations?: string[];
    }
  | {
      type: 'Webhook';
      webhook: { url: string; method: string; headers: Record<string, string>; body: unknown };
    }
  | {
      type: 'Redirect';
      redirectTo: string;
    }
  | {
      type: 'File';
      fileName: string;
      mimeType: string;
      contentBase64: string;
      sizeBytes: number;
    }
  | {
      type: 'FileTooLarge';
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      maxSizeBytes: number;
    };

function formatJsonResult(result: ActionResultFromAgent): FormattedResult {
  // Webhook result
  if (result.webhook) {
    return {
      type: 'Webhook',
      webhook: result.webhook,
    };
  }

  // Redirect result
  if (result.redirectTo) {
    return {
      type: 'Redirect',
      redirectTo: result.redirectTo,
    };
  }

  // Success result (default)
  return {
    type: 'Success',
    message: result.success || 'Action executed successfully',
    html: result.html || undefined,
    invalidatedRelations: result.refresh?.relationships || [],
  };
}

function formatFileResult(buffer: Buffer, mimeType: string, fileName: string): FormattedResult {
  const sizeBytes = buffer.length;

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      type: 'FileTooLarge',
      fileName,
      mimeType,
      sizeBytes,
      maxSizeBytes: MAX_FILE_SIZE_BYTES,
    };
  }

  return {
    type: 'File',
    fileName,
    mimeType,
    contentBase64: buffer.toString('base64'),
    sizeBytes,
  };
}

function createArgumentShape(collectionNames: string[]) {
  return {
    collectionName:
      collectionNames.length > 0
        ? z.enum(collectionNames as [string, ...string[]]).describe('The name of the collection')
        : z.string().describe('The name of the collection'),
    actionName: z.string().describe('The name of the action to execute'),
    recordIds: recordIdsWithPreprocess.describe(
      'The IDs of the records to apply the action to. Required for single/bulk actions, optional for global actions.',
    ),
    values: valuesWithPreprocess.describe(
      'The form field values to set before executing the action. Keys are field names, values are the field values.',
    ),
  };
}

export default function declareExecuteActionTool(
  mcpServer: McpServer,
  forestServerUrl: string,
  logger: Logger,
  collectionNames: string[] = [],
  actionEndpoints: ActionEndpointsMap = {},
): void {
  const argumentShape = createArgumentShape(collectionNames);

  registerToolWithLogging(
    mcpServer,
    'executeAction',
    {
      title: 'Execute an action',
      description:
        'Execute an action on a collection with optional form values. For actions with forms, use getActionForm first to see required fields. File uploads: pass { name, mimeType, contentBase64 } as field value. Returns result with type: Success, Webhook, Redirect, or File (for small files < 5MB).',
      inputSchema: argumentShape,
    },
    async (options: ExecuteActionArgument, extra) => {
      const { rpcClient } = await buildClient(extra, actionEndpoints);

      await createActivityLog(forestServerUrl, extra, 'executeAction', {
        collectionName: options.collectionName,
        label: options.actionName,
      });

      try {
        const recordIds = options.recordIds as string[] | number[] | undefined;
        const action = await rpcClient
          .collection(options.collectionName)
          .action(options.actionName, { recordIds });

        // Set form values if provided (convert file values to data URI format)
        if (options.values && Object.keys(options.values).length > 0) {
          const convertedValues = convertFileValuesToDataUri(options.values);
          await action.setFields(convertedValues);
        }

        // Execute the action with file support
        const result = await action.executeWithFileSupport();

        let formattedResult: FormattedResult;

        if (result.type === 'file') {
          // File download response
          formattedResult = formatFileResult(result.buffer, result.mimeType, result.fileName);
        } else {
          // JSON response (Success, Webhook, Redirect, Error)
          formattedResult = formatJsonResult(result.data as ActionResultFromAgent);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formattedResult, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorDetail = parseAgentError(error);
        throw errorDetail ? new Error(errorDetail) : error;
      }
    },
    logger,
  );
}
