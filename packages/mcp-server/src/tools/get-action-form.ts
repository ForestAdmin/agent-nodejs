import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import parseFileReference from '../file-uploads/file-reference';
import { createActionArgumentShape } from '../utils/action-helpers';
import { buildClientWithActions } from '../utils/agent-caller';
import registerToolWithLogging from '../utils/tool-with-logging';

interface GetActionFormArgument {
  collectionName: string;
  actionName: string;
  recordIds: (string | number)[] | null;
  values?: Record<string, unknown>;
}

// Options may be {value,label} objects or bare primitives — normalize to a consistent shape.
function toAllowedValue(option: unknown): { value: string | number | null; label: string } {
  if (option !== null && typeof option === 'object') {
    const { value, label } = option as { value: string | number | null; label: string };

    return { value, label };
  }

  return { value: option as string | number, label: String(option) };
}

// Setting a field that declares a change hook posts every field value to the agent, and a change
// hook reading `.buffer` off a handle string throws — a 500 on the very sequence executeAction's
// description prescribes. Handles are not resolved on this path on purpose (the bytes would land
// back in the model's context), so they are kept away from the agent and echoed back to the model
// instead: a required file field stays satisfiable, and the model sees its handle was received.
function splitFileReferences(values: Record<string, unknown>): {
  forAgent: Record<string, unknown>;
  withheld: Record<string, unknown>;
} {
  const forAgent: Record<string, unknown> = {};
  const withheld: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(values)) {
    const candidates = Array.isArray(value) ? value : [value];

    if (candidates.some(candidate => parseFileReference(candidate))) withheld[field] = value;
    else forAgent[field] = value;
  }

  return { forAgent, withheld };
}

export default function declareGetActionFormTool(mcpServer: McpServer, ctx: ToolContext): string {
  const { forestServerClient, logger, collectionNames } = ctx;
  const argumentShape = createActionArgumentShape(collectionNames);

  return registerToolWithLogging(
    mcpServer,
    'getActionForm',
    {
      annotations: { readOnlyHint: true },
      title: 'Retrieve action form',
      description: `Retrieve and validate the form for a specific action. This tool MUST be called before executeAction to ensure all required fields are filled.

Workflow:
1. Call getActionForm with the action name and record IDs to get the form fields
2. Check the "canExecute" field in the response - if false, required fields are missing
3. Call getActionForm again with the "values" parameter to fill in the missing required fields
4. Repeat step 2-3 until "canExecute" is true
5. Only then call executeAction with the same values

The response includes:
- fields: Array of form fields with name, type, current value, isRequired flag, description (hint), enumValues (Enum fields), and allowedValues (choice widgets — submit the value, not the label)
- canExecute: Boolean indicating if all required fields have values (ready to execute)
- requiredFields: Array of field names that are required but missing values (empty when canExecute is true)
- skippedFields: Array of field names that were skipped because they no longer exist in the form (due to dynamic form behavior)`,
      inputSchema: argumentShape,
    },
    async (options: GetActionFormArgument, extra) => {
      const { rpcClient } = await buildClientWithActions(
        extra,
        forestServerClient,
        ctx.agentDispatcher,
      );

      // TODO: Enhance when more methods are available in the agent client helper
      // https://github.com/ForestAdmin/forestadmin-experimental/pull/140
      const recordIds = (options.recordIds ?? []) as string[] | number[];
      const action = await rpcClient
        .collection(options.collectionName)
        .action(options.actionName, { recordIds });

      let skippedFields: string[] = [];
      let withheld: Record<string, unknown> = {};

      if (options.values) {
        const split = splitFileReferences(options.values);

        withheld = split.withheld;
        skippedFields = await action.tryToSetFields(split.forAgent);
      }

      const fields = action.getFields();
      // A withheld handle satisfies its field: the agent never saw it, so getValue() is undefined,
      // and counting it as missing would leave canExecute false with nothing the model could send
      // to fix it — a data uri is what it is told never to send, and the handle is what it just
      // sent.
      // An own-property check, not `in`: withheld is keyed by model-sent field names, and `in`
      // walks the prototype chain — a field literally named toString would read as filled by a
      // function. hasOwnProperty.call because this package's lib predates Object.hasOwn.
      const valueOf = (field: { getName(): string; getValue(): unknown }) =>
        Object.prototype.hasOwnProperty.call(withheld, field.getName())
          ? withheld[field.getName()]
          : field.getValue();

      const requiredFields = fields
        .filter(field => field.isRequired())
        .filter(field => valueOf(field) === undefined || valueOf(field) === null)
        .map(field => field.getName());

      const canExecute = requiredFields.length === 0;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              fields: fields.map(field => {
                const description = field.getPlainField()?.description;
                const baseField = {
                  name: field.getName(),
                  type: field.getEffectiveTypeName(),
                  value: valueOf(field),
                  isRequired: field.isRequired() ?? false,
                  ...(description ? { description } : {}),
                };

                if (field.getTypeName() === 'Enum') {
                  const enumField = action.getEnumField(field.getName());

                  return { ...baseField, enumValues: enumField.getOptions() ?? null };
                }

                const widgetOptions = field.getMultipleChoiceField().getOptions();

                return widgetOptions?.length
                  ? { ...baseField, allowedValues: widgetOptions.map(toAllowedValue) }
                  : baseField;
              }),
              canExecute,
              requiredFields,
              skippedFields,
            }),
          },
        ],
      };
    },
    logger,
  );
}
