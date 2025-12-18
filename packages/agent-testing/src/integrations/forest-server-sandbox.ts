import { ForestSchema } from '@forestadmin/forestadmin-client';
import {
  EnvironmentCollectionPermissionsV4,
  EnvironmentPermissionsV4Remote,
  EnvironmentSmartActionPermissionsV4,
} from '@forestadmin/forestadmin-client/dist/permissions/types';
import http from 'node:http';

import { CURRENT_USER } from './forest-admin-client-mock';
import {
  CollectionPermissionsOverride,
  PermissionsOverride,
  SmartActionPermissionsOverride,
} from '../remote-agent-client/domains/remote-agent-client';

export default class ForestServerSandbox {
  private fakeForestServer: http.Server;

  // cache the agent schema for every client to avoid to start several servers when testing agent.
  private readonly agentSchemaCache: Map<string, ForestSchema> = new Map();

  // allow to override some permissions directly from the agent
  private readonly permissionsOverrideCache: Map<string, PermissionsOverride> = new Map();

  port: number;

  constructor(port: number) {
    this.port = port;
  }

  async createServer() {
    const server = http.createServer(this.routes.bind(this));

    this.fakeForestServer = await new Promise((resolve, reject) => {
      server.listen(this.port, () => resolve(server));
      server.on('error', error => {
        console.error('Server error:', error);
        reject(error);
      });
    });

    this.port = (this.fakeForestServer.address() as { port: number }).port;

    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${this.port}`);

    return this;
  }

  async stop() {
    await new Promise((resolve, reject) => {
      this.fakeForestServer.close(error => {
        if (error) reject(error);
        else resolve(null);
      });
    });
  }

  private routes(req: http.IncomingMessage, res: http.ServerResponse) {
    const agentSchemaCacheIdentifier = req.headers['forest-secret-key'] as string;
    console.log(`Handling request`, req.url);

    const sendResponse = (statusCode: number, data?: object) => {
      if (!res.headersSent) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      }

      if (!res.writableEnded) {
        res.end(data ? JSON.stringify(data) : undefined);
      }
    };

    try {
      switch (req.url) {
        case '/agent-schema': {
          let data = '';
          req.on('data', chunk => {
            data += chunk;
          });
          req.on('end', () => {
            this.agentSchemaCache.set(agentSchemaCacheIdentifier, JSON.parse(data));
            sendResponse(200);
          });
          break;
        }

        case '/permission-override': {
          let data = '';
          req.on('data', chunk => {
            data += chunk;
          });
          req.on('end', () => {
            this.permissionsOverrideCache.set(agentSchemaCacheIdentifier, JSON.parse(data));
            sendResponse(200);
          });
          break;
        }

        case '/liana/v4/subscribe-to-events':
          sendResponse(200);
          break;

        case '/liana/v1/ip-whitelist-rules':
          sendResponse(200, { data: { attributes: { use_ip_whitelist: false, rules: [] } } });
          break;

        case '/liana/v4/permissions/environment': {
          try {
            const permissionsV4 = this.transformForestSchemaToEnvironmentPermissionsV4Remote(
              this.agentSchemaCache.get(agentSchemaCacheIdentifier),
              this.permissionsOverrideCache.get(agentSchemaCacheIdentifier),
            );

            sendResponse(200, permissionsV4);
          } catch {
            sendResponse(400, { error: 'Provide a valid schema path' });
          }

          break;
        }

        case '/liana/v4/permissions/users':
          sendResponse(200, [CURRENT_USER]);
          break;

        case '/forest/apimaps/hashcheck':
          sendResponse(200, { sendSchema: false });
          break;

        default:
          if (req.url?.startsWith('/liana/v4/permissions/renderings/')) {
            sendResponse(200, { team: {}, collections: {}, stats: [] });
          } else {
            sendResponse(404, { error: 'Not Found' });
          }
      }
    } catch (error) {
      console.error('Error handling request:', error);
      sendResponse(500, { error: 'Internal Server Error' });
    }
  }

  private transformForestSchemaToEnvironmentPermissionsV4Remote(
    schema: ForestSchema,
    permissionsOverride?: PermissionsOverride,
  ): EnvironmentPermissionsV4Remote {
    const collections = {};

    schema.collections.forEach(collection => {
      const actionPermissions = {};

      collection.actions.forEach(action => {
        actionPermissions[action.name] = this.getCollectionActionPermissions(
          permissionsOverride?.[collection.name]?.actions?.[action.name] || {},
        );
      });

      collections[collection.name] = {
        collection: this.getCollectionCrudPermissions(
          permissionsOverride?.[collection.name]?.collection || {},
        ),
        actions: actionPermissions,
      };
    });

    return { collections };
  }

  private getCollectionCrudPermissions(
    override: CollectionPermissionsOverride,
  ): EnvironmentCollectionPermissionsV4['collection'] {
    return {
      browseEnabled: { roles: [override.browseEnabled === false ? 0 : 1] },
      deleteEnabled: { roles: [override.deleteEnabled === false ? 0 : 1] },
      editEnabled: { roles: [override.editEnabled === false ? 0 : 1] },
      exportEnabled: { roles: [override.exportEnabled === false ? 0 : 1] },
      addEnabled: { roles: [override.addEnabled === false ? 0 : 1] },
      readEnabled: { roles: [override.readEnabled === false ? 0 : 1] },
    };
  }

  private getCollectionActionPermissions(
    override: SmartActionPermissionsOverride,
  ): EnvironmentSmartActionPermissionsV4 {
    return {
      approvalRequired: { roles: [override.approvalRequired === true ? 1 : 0] },
      userApprovalEnabled: { roles: [override.userApprovalEnabled === false ? 0 : 1] },
      selfApprovalEnabled: { roles: [override.selfApprovalEnabled === false ? 0 : 1] },
      triggerEnabled: { roles: [override.triggerEnabled === false ? 0 : 1] },
      triggerConditions: override.triggerConditions
        ? [{ roleId: 1, filter: override.triggerConditions }]
        : [],
      userApprovalConditions: override.userApprovalConditions
        ? [{ roleId: 1, filter: override.userApprovalConditions }]
        : [],
      approvalRequiredConditions: override.approvalRequiredConditions
        ? [{ roleId: 1, filter: override.approvalRequiredConditions }]
        : [],
    };
  }
}
