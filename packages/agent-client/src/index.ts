import type { ActionEndpointsByCollection } from './domains/action';
import type {
  CollectionPermissionsOverride,
  PermissionsOverride,
  SmartActionPermissionsOverride,
} from './domains/remote-agent-client';

import ActionFieldJson from './action-fields/action-field-json';
import ActionFieldStringList from './action-fields/action-field-string-list';
import ApprovalRequestCreator from './approval-request-creator';
import RemoteAgentClient from './domains/remote-agent-client';
import AgentHttpError, { ActionFormValidationError, ActionRequiresApprovalError } from './errors';
import HttpRequester from './http-requester';

export {
  ActionFieldJson,
  ActionFieldStringList,
  ApprovalRequestCreator,
  RemoteAgentClient,
  HttpRequester,
  AgentHttpError,
  ActionRequiresApprovalError,
  ActionFormValidationError,
};
export type {
  ActionEndpointsByCollection,
  CollectionPermissionsOverride,
  PermissionsOverride,
  SmartActionPermissionsOverride,
};
export type { ApprovalRequestPayload } from './approval-request-creator';

export function createRemoteAgentClient(params: {
  overridePermissions?: (permissions: PermissionsOverride) => Promise<void>;
  actionEndpoints?: ActionEndpointsByCollection;
  token?: string;
  url: string;
  forestServer?: { url: string; forestServerToken: string; renderingId: number | string };
}) {
  const httpRequester = new HttpRequester(params.token, { url: params.url });

  return new RemoteAgentClient({
    actionEndpoints: params.actionEndpoints,
    httpRequester,
    overridePermissions: params.overridePermissions,
    approvalRequestCreator: params.forestServer
      ? new ApprovalRequestCreator({
          forestServerUrl: params.forestServer.url,
          forestServerToken: params.forestServer.forestServerToken,
          renderingId: params.forestServer.renderingId,
        })
      : undefined,
  });
}

export type { RecordId, SelectOptions } from './types';
