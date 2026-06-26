import type { ActionEndpointsByCollection } from './domains/action';

import ActionFieldJson from './action-fields/action-field-json';
import ActionFieldStringList from './action-fields/action-field-string-list';
import RemoteAgentClient from './domains/remote-agent-client';
import AgentHttpError, { ActionFormValidationError, ActionRequiresApprovalError } from './errors';
import HttpRequester from './http-requester';

export {
  ActionFieldJson,
  ActionFieldStringList,
  RemoteAgentClient,
  HttpRequester,
  AgentHttpError,
  ActionRequiresApprovalError,
  ActionFormValidationError,
};
export type { ActionEndpointsByCollection };

export function createRemoteAgentClient(params: {
  actionEndpoints?: ActionEndpointsByCollection;
  token?: string;
  url: string;
}) {
  const httpRequester = new HttpRequester(params.token, { url: params.url });

  return new RemoteAgentClient({
    actionEndpoints: params.actionEndpoints,
    httpRequester,
  });
}

export type { RecordId, SelectOptions } from './types';
