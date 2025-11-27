/* eslint-disable no-restricted-imports */
// export a new interface to remove all testing dependencies into the @forestadmin-experimental/agent-nodejs-testing
// import type { DeleteArgument } from './types/tool-delete-type';
// import type { UpdateArgument } from './types/tool-update-type';
// import type { EnvironmentStore, ModelStore, RenderingStore, User } from '@forestadmin/private-api';
// import type ActivityLogCreator from '@forestadmin/private-api/dist/src/services/activity-logs/activity-log-creator';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

// import { generateCollectionIdFromModelName } from '@forestadmin/private-api/dist/src/domain/layout/layout-builder';
import { createRemoteAgentClient } from '@forestadmin-experimental/agent-nodejs-testing';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import filterSchema from './schemas/filter.js';
// import { type CreateArgument, createArgumentSchema } from './types/tool-create-type';
// import { deleteArgumentSchema } from './types/tool-delete-type';
// import { updateArgumentSchema } from './types/tool-update-type';

const listArgumentShape = {
  collectionName: z.string(),
  search: z.string().optional(),
  filters: filterSchema.optional(),
  sort: z
    .object({
      field: z.string(),
      ascending: z.boolean(),
    })
    .optional(),
};
const listArgumentSchema = z.object(listArgumentShape);
type ListArgument = z.infer<typeof listArgumentSchema>;

// const hasManyArgumentSchema = z.object({
//   collectionName: z.string(),
//   relationName: z.string(),
//   parentRecordId: z.union([z.string(), z.number()]),
//   search: z.string().optional(),
//   filters: filterSchema.optional(),
// });
// type HasManyArgument = z.infer<typeof hasManyArgumentSchema>;

// const actionArgumentSchema = z.object({
//   collectionName: z.string(),
//   actionName: z.string(),
//   recordIds: z.union([z.array(z.string()), z.array(z.number())]),
// });
// type ActionArgumentSchema = z.infer<typeof actionArgumentSchema>;

// const getActionFormSchema = z.object({
//   collectionName: z.string(),
//   actionName: z.string(),
//   recordIds: z.union([z.array(z.string()), z.array(z.number())]),
//   values: z.record(z.string(), z.union([z.string(), z.number()])), // TODO: Update the type
// });
// type GetActionFormSchema = z.infer<typeof getActionFormSchema>;

// const availableActionArgumentSchema = z.object({
//   collectionName: z.string().optional(),
// });
// type AvailableActionArgument = z.infer<typeof availableActionArgumentSchema>;

/*
 * This class serves as the communication gateway between the MCP clients
 * and individual customer agents. It acts as a bridge allowing MCP clients
 * to interact with customer agents through the MCP server hosted on the FA server.
 *
 */
export default class ToolsCreator {
  public static createTools({
    mcpServer,
    forestServerUrl,
  }: {
    mcpServer: McpServer;
    forestServerUrl: string;
  }) {
    // TODO: How monitor tools execution?
    // TODO: Custom billing, how to handle it?
    this.declareListTool(mcpServer, forestServerUrl);
    // this.declareListHasManyTool();
    // this.declareAvailableCollectionsTool();
    // this.declareAvailableActionsTool();
    // this.declareActionTool();
    // this.declareUpdateTool();
    // this.declareDeleteTool();
    // this.declareActionFormTool();
    // this.declareCreateTool();
  }

  /**
   * This tool will be very useful to retrieve the collections
   * list to forward to the AI the available collections
   */
  // private declareAvailableCollectionsTool() {
  //   this.server.tool(
  //     'getAvailableCollections',
  //     'Lists the available collections for the current environment.',
  //     {},
  //     async (options, extra) => {
  //       const {
  //         authData: { userId, renderingId },
  //         environmentId,
  //       } = await this.buildClient(extra);

  //       const collections = await this.modelStore.getAll(environmentId);
  //       const collectionMapped = collections
  //         .filter(collection => !collection.onlyForRelationships)
  //         .map(collection => ({
  //           id: collection.id,
  //           name: collection.name,
  //           onlyForRelationships: collection.onlyForRelationships,
  //           fields: collection.definition.fields.map(field => ({
  //             id: field.id,
  //             name: field.name,
  //             type: field.type,
  //             relationship: field.relationship,
  //             canFilter: field.canFilter ?? true,
  //             isSortable: field.isSortable,
  //             isReadOnly: field.isReadOnly ?? false,
  //             isPrimaryKey: field.isPrimaryKey ?? false,
  //           })),
  //         }));

  //       await this.createActivityLog(userId, renderingId, 'availableCollections', options);

  //       return {
  //         content: [{ type: 'text', text: JSON.stringify(collectionMapped) }],
  //       };
  //     },
  //   );
  // }

  /**
   * This tool will be used to list the data from the customer agent
   * It will be used by the AI to retrieve the data from the customer agent
   */
  private static declareListTool(mcpServer: McpServer, forestServerUrl: string) {
    mcpServer.registerTool(
      'list',
      {
        title: 'List data from the customer agent',
        description: 'Retrieve a list of data from the specified collection in the customer agent.',
        inputSchema: listArgumentShape,
      },
      async (options: ListArgument, extra) => {
        const {
          rpcClient,
          authData: { renderingId },
        } = await this.buildClient(extra);

        let actionType = 'index';

        if (options.search) {
          actionType = 'search';
        } else if (options.filters) {
          actionType = 'filter';
        }

        await this.createActivityLog(
          forestServerUrl,
          extra.authInfo.extra.id as string,
          renderingId,
          actionType,
          {
            collectionName: options.collectionName,
          },
        );

        const result = await rpcClient
          .collection(options.collectionName)
          .list(this.getListParameters(options));

        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    );
  }

  /**
   * This tool will be used to list the data from the customer agent
   * It will be used by the AI to retrieve the data from the customer agent
   */
  // private declareListHasManyTool() {
  //   this.server.tool(
  //     'getHasMany',
  //     'List all records related to a parent record in a hasMany relationship. It will returns jsonapi format.',
  //     hasManyArgumentSchema.shape,
  //     async (options: HasManyArgument, extra) => {
  //       const {
  //         rpcClient,
  //         authData: { renderingId, userId },
  //       } = await this.buildClient(extra);

  //       await this.createActivityLog(userId, renderingId, 'listHasMany', options);

  //       const result = await rpcClient
  //         .collection(options.collectionName)
  //         .relation(options.relationName, options.parentRecordId)
  //         .list(this.getListParameters(options));

  //       return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  //     },
  //   );
  // }

  /**
   * This tool will be used to retrieve the available actions for a collection
   * It will be used by the AI to retrieve the actions from the customer agent
   */
  // private declareAvailableActionsTool() {
  //   // TODO: Implement this tool to retrieve the available actions for a collection
  //   this.server.tool(
  //     'getAvailableActions',
  //     'List all actions available for a project',
  //     availableActionArgumentSchema.shape,
  //     async (options: AvailableActionArgument, extra) => {
  //       const {
  //         authData: { userId, renderingId },
  //         environmentId,
  //       } = await this.buildClient(extra);
  //       const models = (await this.modelStore.getAll(environmentId)).filter(model =>
  //         options.collectionName ? model.name === options.collectionName : true,
  //       );
  //       const actionTypeToAIType = {
  //         single: 'execute on a single record',
  //         bulk: 'execute on multiple records',
  //         global: 'execute for a collection not related to a record',
  //       };
  //       const actions = models
  //         .map(model =>
  //           model.definition.actions.map(action => ({
  //             actionName: action.name,
  //             description: action.description,
  //             collectionName: model.name,
  //             isDownloadFileAction: action.download,
  //             type: actionTypeToAIType[action.type],
  //           })),
  //         )
  //         .flat();

  //       await this.createActivityLog(userId, renderingId, 'availableActions', options);

  //       return {
  //         content: [{ type: 'text', text: JSON.stringify(actions) }],
  //       };
  //     },
  //   );
  // }

  private declareActionFormTool() {
    // TODO: Uncomment when the new method are available in the agent client helper
    // https://github.com/ForestAdmin/forestadmin-experimental/pull/140
    /* this.server.tool(
      'getActionForm',
      'Retrieve the form for a specific action',
      async ({ actionName, collectionName, recordIds, values }: GetActionFormSchema, extra) => {
        await this.authenticate(extra);
        const client = await this.buildClient(extra);
        const action = await client.collection(collectionName).action(actionName, { recordIds });

        if (values) {
          await action.setFields(values);
        }

        const fields = action.getFields();

        const isValid = fields
          .filter(field => field.getPlainField().isRequired)
          .every(field => !!field.getValue());

        await this.createActivityLog(userId, renderingId, 'actionForm', options);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                fields: fields.map(field => ({
                  name: field.getName(),
                  type: field.getType(),
                  value: field.getValue(),
                  description: field.getPlainField().description,
                  isRequired: field.getPlainField().isRequired ?? false,
                  isReadOnly: field.getPlainField().isReadOnly ?? false,
                  enumValues: field.getPlainField().enums,
                })),
                isValid,
              }),
            },
          ],
        };
      },
    ); */
  }

  /**
   * This tool will be used to execute an action on a collection
   */
  // private declareActionTool() {
  //   // TODO: Find a way to support forms in the actions
  //   this.server.tool(
  //     'executeAction',
  //     actionArgumentSchema.shape,
  //     async (options: ActionArgumentSchema, extra) => {
  //       const {
  //         rpcClient,
  //         authData: { userId, renderingId },
  //       } = await this.buildClient(extra);

  //       await this.createActivityLog(userId, renderingId, 'action', {
  //         ...options,
  //         label: `Trigger the action "${options.actionName}" ${options.recordIds.join(',')} from the collection ${options.collectionName}`,
  //       });
  //       const action = await rpcClient
  //         .collection(options.collectionName)
  //         .action(options.actionName, {
  //           recordIds: options.recordIds,
  //         });
  //       const result = await action.execute();

  //       return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  //     },
  //   );
  // }

  // private declareUpdateTool() {
  //   this.server.tool(
  //     'update',
  //     'Use the update tool to update a record in a collection.',
  //     updateArgumentSchema.shape,
  //     async (options: UpdateArgument, extra) => {
  //       const {
  //         rpcClient,
  //         authData: { userId, renderingId },
  //       } = await this.buildClient(extra);

  //       await this.createActivityLog(userId, renderingId, 'update', {
  //         ...options,
  //         label: `update the record ${options.recordId} from the collection ${options.collectionName}`,
  //       });

  //       await rpcClient
  //         .collection(options.collectionName)
  //         .update(options.recordId, options.attributes);

  //       // if the record is not found, the result will be { data: null }
  //       // it must throw an error if the record is not found
  //       return {
  //         content: [{ type: 'text', text: `Record ${options.recordId} updated successfully.` }],
  //       };
  //     },
  //   );
  // }

  // private declareCreateTool() {
  //   this.server.tool(
  //     'create',
  //     'Use the create tool to add a record in a collection.',
  //     createArgumentSchema.shape,
  //     async (options: CreateArgument, extra) => {
  //       const {
  //         rpcClient,
  //         authData: { userId, renderingId },
  //       } = await this.buildClient(extra);
  //       const newRecord = await rpcClient
  //         .collection(options.collectionName)
  //         .create<{ data: { id: string } }>(options.attributes);

  //       await this.activityLogCreator.create({ id: userId } as User, {
  //         type: 'write',
  //         collection: { id: options.collectionName },
  //         action: 'create',
  //         userId,
  //         label: `Created a record in the collection ${options.collectionName}`,
  //         records: [newRecord.data.id],
  //         rendering: { id: parseInt(renderingId, 10) },
  //       });

  //       await this.createActivityLog(userId, renderingId, 'create', {
  //         ...options,
  //         label: `Created a record in the collection ${options.collectionName}`,
  //       });

  //       return {
  //         content: [
  //           { type: 'text', text: `Record ${options.collectionName} created successfully.` },
  //         ],
  //       };
  //     },
  //   );
  // }

  // private declareDeleteTool() {
  //   this.server.tool(
  //     'delete',
  //     'Use the delete tool to delete records in a collection.',
  //     deleteArgumentSchema.shape,
  //     async (options: DeleteArgument, extra) => {
  //       const {
  //         rpcClient,
  //         authData: { userId, renderingId },
  //       } = await this.buildClient(extra);

  //       await this.createActivityLog(userId, renderingId, 'delete', {
  //         ...options,
  //         label: `deleted the records ${options.recordIds.join(',')} from the collection ${options.collectionName}`,
  //       });
  //       await rpcClient.collection(options.collectionName).delete(options.recordIds);

  //       return {
  //         content: [
  //           { type: 'text', text: `Records ${options.recordIds.join(',')} deleted successfully.` },
  //         ],
  //       };
  //     },
  //   );
  // }

  private static async buildClient(
    request: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) {
    // TODO: improve this code to be authenticated to the customer agent
    // How to retrieve the user information when a mcp client is calling the agent?
    // The mcp server can be called by a mcp client hosted on forestadmin or by an external mcp client.
    // How to identify the user when the mcp client is external?

    // token to authenticate on the server (session-token)
    // Use session-creator to generate a bearer token

    const token = request.authInfo?.token;

    const rpcClient = createRemoteAgentClient({
      token,
      url: process.env.AGENT_HOSTNAME || 'http://localhost:3310',
      actionEndpoints: {}, // trouver les endpoints des actions dans le rendering ?
    });

    return {
      rpcClient,
      authData: request.authInfo?.extra as {
        userId: number;
        renderingId: string;
        environmentId: number;
        projectId: number;
      },
      environmentId: request.authInfo?.extra?.environmentId as number,
    };
  }

  private static getListParameters(options: ListArgument): {
    filters?: Record<string, unknown>;
    search?: string;
    sort?: { field: string; ascending: boolean };
  } {
    const parameters: {
      filters?: Record<string, unknown>;
      search?: string;
      sort?: { field: string; ascending: boolean };
    } = {};

    if (options.filters) {
      parameters.filters = { conditionTree: options.filters as Record<string, unknown> };
    }

    if (options.search) {
      parameters.search = options.search;
    }

    if (options.sort?.field && options.sort?.ascending) {
      parameters.sort = options.sort as { field: string; ascending: boolean };
    }

    return parameters;
  }

  private static async createActivityLog(
    forestServerUrl: string,
    userId: string,
    renderingId: number | string,
    action: string,
    extra?: {
      collectionName?: string;
      recordId?: string | number;
      recordIds?: string[] | number[];
      label?: string;
    },
  ) {
    const actionToType = {
      index: 'read',
      search: 'read',
      filters: 'read',
      listHasMany: 'read',
      actionForm: 'read',
      action: 'write',
      create: 'write',
      update: 'write',
      delete: 'write',
      availableActions: 'read',
      availableCollections: 'read',
    };

    if (!actionToType[action]) {
      throw new Error(`Unknown action type: ${action}`);
    }

    const type = actionToType[action] as 'read' | 'write';

    const response = await fetch(`${forestServerUrl}/liana/activity-logs-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Forest-Application-Source': 'MCP',
        'forest-secret-key': process.env.FOREST_ENV_SECRET || '',
      },
      body: JSON.stringify({
        data: {
          id: 1,
          type: 'activity-logs-requests',
          attributes: {
            type,
            action,
            label: extra?.label,
            records: (extra?.recordIds || (extra?.recordId ? [extra.recordId] : [])) as string[],
          },
          relationships: {
            rendering: {
              data: {
                id: renderingId,
                type: 'renderings',
              },
            },
            collection: {
              data: extra?.collectionName
                ? {
                    id: extra.collectionName,
                    type: 'collections',
                  }
                : null,
            },
            user: {
              data: {
                id: userId,
                type: 'users',
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create activity log: ${await response.text()}`);
    }

    // FIXME: Call the forest api
    // return this.activityLogCreator.create({ id: userId } as User, {
    //   type,
    //   action,
    //   userId,
    //   label: extra?.label,
    //   rendering: { id: Number.parseInt(`${renderingId}`, 10) },
    //   collection: extra?.collectionName
    //     ? { id: generateCollectionIdFromModelName(extra.collectionName) }
    //     : undefined,
    //   records: (extra?.recordIds || (extra.recordId ? [extra.recordId] : [])) as string[],
    //   applicationSource: 'MCP',
    // });
  }
}
