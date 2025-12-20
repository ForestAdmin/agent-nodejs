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

interface GetActionFormArgument {
  collectionName: string;
  actionName: string;
  recordIds?: (string | number)[];
  values?: Record<string, unknown>;
}

function createArgumentShape(collectionNames: string[]) {
  return {
    collectionName:
      collectionNames.length > 0
        ? z.enum(collectionNames as [string, ...string[]]).describe('The name of the collection')
        : z.string().describe('The name of the collection'),
    actionName: z.string().describe('The name of the action to get the form for'),
    recordIds: recordIdsWithPreprocess.describe(
      'The IDs of the records to apply the action to. Required for single/bulk actions, optional for global actions.',
    ),
    values: valuesWithPreprocess.describe(
      'Optional field values to set. Use this to trigger dynamic form updates and discover fields that depend on other field values. The response will show the updated fields after change hooks are executed.',
    ),
  };
}

interface PlainField {
  field: string;
  type: string;
  description?: string;
  value?: unknown;
  isRequired: boolean;
  isReadOnly: boolean;
  widgetEdit?: {
    parameters: {
      static: {
        options?: { label: string; value: string }[];
      };
    };
  };
  enums?: string[];
}

interface ActionFieldInfo {
  getName: () => string;
  getType: () => string;
  getValue: () => unknown;
  isRequired: () => boolean;
  getPlainField?: () => PlainField;
}

function formatFieldForResponse(field: ActionFieldInfo) {
  const plainField = field.getPlainField?.();

  return {
    name: field.getName(),
    type: field.getType(),
    value: field.getValue(),
    isRequired: field.isRequired(),
    isReadOnly: plainField?.isReadOnly ?? false,
    description: plainField?.description ?? null,
    enums: plainField?.enums ?? null,
    options: plainField?.widgetEdit?.parameters?.static?.options ?? null,
  };
}

interface LayoutElement {
  component: string;
  fieldId?: string;
  content?: string;
  fields?: LayoutElement[];
  elements?: LayoutElement[];
  nextButtonLabel?: string;
  previousButtonLabel?: string;
}

function formatLayoutForResponse(layout: LayoutElement[]): unknown {
  if (!layout || layout.length === 0) return null;

  // Check if layout has pages
  const hasPages = layout.some(el => el.component === 'page');

  if (hasPages) {
    return {
      type: 'multi-page',
      pages: layout
        .filter(el => el.component === 'page')
        .map((page, index) => ({
          pageNumber: index + 1,
          elements: page.elements || [],
          nextButtonLabel: page.nextButtonLabel,
          previousButtonLabel: page.previousButtonLabel,
        })),
    };
  }

  return {
    type: 'single-page',
    elements: layout,
  };
}

export default function declareGetActionFormTool(
  mcpServer: McpServer,
  forestServerUrl: string,
  logger: Logger,
  collectionNames: string[] = [],
  actionEndpoints: ActionEndpointsMap = {},
): void {
  const argumentShape = createArgumentShape(collectionNames);

  registerToolWithLogging(
    mcpServer,
    'getActionForm',
    {
      title: 'Get action form',
      description:
        'Load the form fields for an action. Supports dynamic forms: pass values to trigger change hooks and discover fields that depend on other fields. For multi-page forms, the layout shows page structure. Call multiple times with progressive values to handle complex dynamic forms across pages.',
      inputSchema: argumentShape,
    },
    async (options: GetActionFormArgument, extra) => {
      const { rpcClient } = await buildClient(extra, actionEndpoints);

      await createActivityLog(forestServerUrl, extra, 'getActionForm', {
        collectionName: options.collectionName,
        label: options.actionName,
      });

      try {
        const recordIds = options.recordIds as string[] | number[] | undefined;
        const action = await rpcClient
          .collection(options.collectionName)
          .action(options.actionName, { recordIds });

        // Set field values if provided - this triggers change hooks for dynamic forms
        if (options.values && Object.keys(options.values).length > 0) {
          await action.setFields(options.values);
        }

        const fields = action.getFields();
        const formattedFields = fields.map(formatFieldForResponse);

        // Get layout for multi-page forms
        const layout = action.getLayout();
        const formattedLayout = formatLayoutForResponse(
          layout?.['layout'] as LayoutElement[] | undefined,
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  collectionName: options.collectionName,
                  actionName: options.actionName,
                  fields: formattedFields,
                  layout: formattedLayout,
                },
                null,
                2,
              ),
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
