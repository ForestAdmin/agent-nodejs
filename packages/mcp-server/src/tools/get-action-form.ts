import type { ToolContext } from '../tool-context';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { describeActionForm } from '@forestadmin/agent-client';

import parseFileReference from '../file-uploads/file-reference';
import { createActionArgumentShape } from '../utils/action-helpers';
import { buildClientWithActions } from '../utils/agent-caller';
import { fetchForestSchema } from '../utils/schema-fetcher';
import {
  UNREACHABLE,
  actionDescriptionText,
  readSemanticLayer,
  withDescription,
} from '../utils/semantic-layer';
import registerToolWithLogging from '../utils/tool-with-logging';

interface GetActionFormArgument {
  collectionName: string;
  actionName: string;
  recordIds: (string | number)[] | null;
  values?: Record<string, unknown>;
}

// Options may be {value,label} objects or bare primitives — normalize to a consistent shape.
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
5. After each call, look for fields that were not in the previous response: setting a value can reveal new fields. Fill the ones the user's request covers with another getActionForm call, since "canExecute" only means the required fields are filled
6. Only then call executeAction with the same values

The response includes:
- description: what the action does, when one is written
- fields: Array of form fields with name, type, current value, isRequired flag, description (hint), enumValues (Enum fields), and allowedValues (choice widgets — submit the value, not the label)
- canExecute: Boolean indicating if all required fields have values (ready to execute)
- requiredFields: Array of field names that are required but missing values (empty when canExecute is true)
- skippedFields: Array of field names that were skipped because they no longer exist in the form (due to dynamic form behavior)`,
      inputSchema: argumentShape,
    },
    async (options: GetActionFormArgument, extra) => {
      const { rpcClient } = await buildClientWithActions(extra, ctx);

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

      const { fields, requiredFields, canExecute } = describeActionForm(action, withheld);

      const forestDescription = await readSemanticLayer(extra, logger, caller =>
        forestServerClient.getSemanticLayerActionDescription({
          ...caller,
          collectionName: options.collectionName,
          actionName: options.actionName,
        }),
      );
      const codeDescription = (await fetchForestSchema(forestServerClient)).collections
        ?.find(collection => collection.name === options.collectionName)
        ?.actions?.find(schemaAction => schemaAction.name === options.actionName)?.description;
      let actionDescription: string | undefined;

      if (forestDescription === UNREACHABLE) actionDescription = undefined;
      else if (forestDescription === undefined) actionDescription = codeDescription;
      else actionDescription = actionDescriptionText(forestDescription, codeDescription);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...withDescription(actionDescription),
              fields: fields.map(
                ({
                  name,
                  effectiveType,
                  value,
                  isRequired,
                  description,
                  enumValues,
                  allowedValues,
                }) => ({
                  name,
                  type: effectiveType,
                  value,
                  isRequired,
                  ...(description ? { description } : {}),
                  ...(enumValues !== undefined ? { enumValues } : {}),
                  ...(allowedValues ? { allowedValues } : {}),
                }),
              ),
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
