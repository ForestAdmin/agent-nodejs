import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { z } from 'zod';

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

// Widget parameters as returned by the agent (varies by widget type)
interface WidgetParameters {
  // Common
  placeholder?: string | null;
  // Options (for dropdown, radio, checkboxes)
  static?: {
    options?: { label: string; value: string | number }[];
  };
  isSearchable?: boolean;
  searchType?: 'dynamic' | null;
  // Number fields
  min?: number | null;
  max?: number | null;
  step?: number | null;
  // Text area
  rows?: number | null;
  // Date picker
  format?: string | null;
  minDate?: string | null;
  maxDate?: string | null;
  // Color picker
  enableOpacity?: boolean;
  quickPalette?: string[] | null;
  // Currency
  currency?: string | null;
  base?: 'Unit' | 'Cents' | null;
  // File picker
  filesExtensions?: string[] | null;
  filesSizeLimit?: number | null;
  filesCountLimit?: number | null;
  // List fields
  enableReorder?: boolean;
  allowDuplicate?: boolean;
  allowEmptyValue?: boolean;
}

interface PlainField {
  field: string;
  type: string;
  description?: string;
  value?: unknown;
  isRequired: boolean;
  isReadOnly: boolean;
  widgetEdit?: {
    name: string;
    parameters: WidgetParameters;
  };
  enums?: string[];
  // For Collection fields
  reference?: string | null;
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
  const widgetEdit = plainField?.widgetEdit;
  const params = widgetEdit?.parameters;

  // Build widget configuration object with all relevant metadata
  const widget: Record<string, unknown> = {};

  if (widgetEdit?.name) {
    widget.type = widgetEdit.name;
  }

  // Extract all widget parameters that are set
  if (params) {
    if (params.placeholder != null) widget.placeholder = params.placeholder;
    if (params.min != null) widget.min = params.min;
    if (params.max != null) widget.max = params.max;
    if (params.step != null) widget.step = params.step;
    if (params.rows != null) widget.rows = params.rows;
    if (params.format != null) widget.format = params.format;
    if (params.minDate != null) widget.minDate = params.minDate;
    if (params.maxDate != null) widget.maxDate = params.maxDate;
    if (params.enableOpacity != null) widget.enableOpacity = params.enableOpacity;
    if (params.quickPalette != null) widget.quickPalette = params.quickPalette;
    if (params.currency != null) widget.currency = params.currency;
    if (params.base != null) widget.currencyBase = params.base;
    if (params.filesExtensions != null) widget.allowedExtensions = params.filesExtensions;
    if (params.filesSizeLimit != null) widget.maxSizeMb = params.filesSizeLimit;
    if (params.filesCountLimit != null) widget.maxFiles = params.filesCountLimit;
    if (params.enableReorder != null) widget.enableReorder = params.enableReorder;
    if (params.allowDuplicate != null) widget.allowDuplicates = params.allowDuplicate;
    if (params.allowEmptyValue != null) widget.allowEmptyValues = params.allowEmptyValue;
    if (params.isSearchable != null) widget.isSearchable = params.isSearchable;
    if (params.searchType === 'dynamic') widget.hasDynamicSearch = true;
  }

  return {
    name: field.getName(),
    type: field.getType(),
    value: field.getValue(),
    isRequired: field.isRequired(),
    isReadOnly: plainField?.isReadOnly ?? false,
    description: plainField?.description ?? null,
    enums: plainField?.enums ?? null,
    options: params?.static?.options ?? null,
    // Include widget config only if it has any properties
    widget: Object.keys(widget).length > 0 ? widget : null,
    // For Collection fields, include the reference
    reference: plainField?.reference ?? null,
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

interface FormHints {
  canExecute: boolean;
  requiredFieldsMissing: string[];
}

function computeFormHints(fields: ActionFieldInfo[]): FormHints {
  const requiredFieldsMissing: string[] = [];

  for (const field of fields) {
    const value = field.getValue();
    const isRequired = field.isRequired();
    const name = field.getName();

    // Check for missing required fields
    if (isRequired && (value === undefined || value === null || value === '')) {
      requiredFieldsMissing.push(name);
    }
  }

  return {
    canExecute: requiredFieldsMissing.length === 0,
    requiredFieldsMissing,
  };
}

export default function declareGetActionFormTool(
  mcpServer: McpServer,
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
        'Load the form fields for an action. Forms can be dynamic: changing a field value may reveal or hide other fields. To handle this, fill fields from top to bottom and call getActionForm again with the updated values to see if new fields appeared. The response includes "hints" with canExecute (all required fields filled?) and requiredFieldsMissing (list of required fields without values).',
      inputSchema: argumentShape,
    },
    async (options: GetActionFormArgument, extra) => {
      const { rpcClient } = await buildClient(extra, actionEndpoints);

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
          // eslint-disable-next-line @typescript-eslint/dot-notation
          layout?.['layout'] as LayoutElement[] | undefined,
        );

        // Compute hints to guide the LLM on form completion
        const hints = computeFormHints(fields);

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
                  hints,
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
