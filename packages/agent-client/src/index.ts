import type { ActionEndpointsByCollection } from './domains/action';
import type {
  CollectionPermissionsOverride,
  PermissionsOverride,
  SmartActionPermissionsOverride,
} from './domains/remote-agent-client';

import ActionFieldJson from './action-fields/action-field-json';
import ActionFieldStringList from './action-fields/action-field-string-list';
import makeCreateApprovalRequest from './approval-request-creator';
import RemoteAgentClient from './domains/remote-agent-client';
import AgentHttpError, {
  ActionFormValidationError,
  ActionRequiresApprovalError,
  ApprovalRequestCreationError,
} from './errors';
import HttpRequester, { buildAgentHttpError, deserializeAgentBody } from './http-requester';

export {
  ActionFieldJson,
  ActionFieldStringList,
  makeCreateApprovalRequest,
  RemoteAgentClient,
  HttpRequester,
  buildAgentHttpError,
  deserializeAgentBody,
  AgentHttpError,
  ActionRequiresApprovalError,
  ActionFormValidationError,
  ApprovalRequestCreationError,
};
export type {
  ActionEndpointsByCollection,
  CollectionPermissionsOverride,
  PermissionsOverride,
  SmartActionPermissionsOverride,
};
export type { ApprovalRequestPayload, CreateApprovalRequest } from './approval-request-creator';

export function createRemoteAgentClient(params: {
  overridePermissions?: (permissions: PermissionsOverride) => Promise<void>;
  actionEndpoints?: ActionEndpointsByCollection;
  token?: string;
  url: string;
  /**
   * Connection to the Forest Admin server. Provide it to enable server-side features that call the
   * Forest server (e.g. creating approval requests); omit it for a client that only talks to the
   * agent (e.g. tests). `serverUrl` is the Forest server, distinct from the agent `url` above.
   */
  forestServer?: { serverUrl: string; serverToken: string; renderingId: number | string };
  httpRequester?: HttpRequester;
}) {
  const httpRequester =
    params.httpRequester ?? new HttpRequester(params.token, { url: params.url });

  return new RemoteAgentClient({
    actionEndpoints: params.actionEndpoints,
    httpRequester,
    overridePermissions: params.overridePermissions,
    createApprovalRequest: params.forestServer
      ? makeCreateApprovalRequest({
          forestServerUrl: params.forestServer.serverUrl,
          forestServerToken: params.forestServer.serverToken,
          renderingId: params.forestServer.renderingId,
        })
      : undefined,
  });
}

export type { RecordId, SelectOptions } from './types';
