import type { ForestServerClient } from '../http-client';
import type { Logger } from '../server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { createActionArgumentShape } from '../utils/action-helpers';
import { buildClientWithActions } from '../utils/agent-caller';
import registerToolWithLogging from '../utils/tool-with-logging';

interface GetActionFormArgument {
  collectionName: string;
  actionName: string;
  recordIds: (string | number)[];
  values?: Record<string, unknown>;
}

export default function declareGetActionFormTool(
  mcpServer: McpServer,
  forestServerClient: ForestServerClient,
  logger: Logger,
  collectionNames: string[] = [],
): string {
  const argumentShape = createActionArgumentShape(collectionNames);

  return registerToolWithLogging(
    mcpServer,
    'getActionForm',
    {
      title: 'Retrieve action form',
      description: `Retrieve and validate the form for a specific action. This tool MUST be called before executeAction to ensure all required fields are filled.

Workflow:
1. Call getActionForm with the action name and record IDs to get the form fields
2. Check the "isValid" field in the response - if false, required fields are missing
3. Call getActionForm again with the "values" parameter to fill in the missing required fields
4. Repeat step 2-3 until "isValid" is true
5. Only then call executeAction with the same values

The response includes:
- fields: Array of form fields with name, type, current value, and isRequired flag
- isValid: Boolean indicating if all required fields have values (ready to execute)`,
      inputSchema: argumentShape,
    },
    async (options: GetActionFormArgument, extra) => {
      const { rpcClient } = await buildClientWithActions(extra, forestServerClient);

      // TODO: Enhance when more methods are available in the agent client helper
      // https://github.com/ForestAdmin/forestadmin-experimental/pull/140
      const recordIds = options.recordIds as string[] | number[];
      const action = await rpcClient
        .collection(options.collectionName)
        .action(options.actionName, { recordIds });

      if (options.values) {
        await action.setFields(options.values);
      }

      const fields = action.getFields();

      const isValid = fields
        .filter(field => field.isRequired())
        .every(field => field.getValue() !== undefined && field.getValue() !== null);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              fields: fields.map(field => ({
                name: field.getName(),
                type: field.getType(),
                value: field.getValue(),
                isRequired: field.isRequired() ?? false,
              })),
              isValid,
            }),
          },
        ],
      };
    },
    logger,
  );
}
