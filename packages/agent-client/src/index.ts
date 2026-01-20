import type { ActionEndpointsByCollection } from './domains/action';
import type {
  CollectionPermissionsOverride,
  PermissionsOverride,
  SmartActionPermissionsOverride,
} from './domains/remote-agent-client';

import ActionFieldJson from './action-fields/action-field-json';
import ActionFieldStringList from './action-fields/action-field-string-list';
import RemoteAgentClient from './domains/remote-agent-client';
import HttpRequester from './http-requester';

export { ActionFieldJson, ActionFieldStringList, RemoteAgentClient, HttpRequester };
export type {
  ActionEndpointsByCollection,
  CollectionPermissionsOverride,
  PermissionsOverride,
  SmartActionPermissionsOverride,
};

export function createRemoteAgentClient(params: {
  overridePermissions?: (permissions: PermissionsOverride) => Promise<void>;
  actionEndpoints?: ActionEndpointsByCollection;
  token?: string;
  url: string;
}) {
  const httpRequester = new HttpRequester(params.token, { url: params.url });

  return new RemoteAgentClient({
    actionEndpoints: params.actionEndpoints,
    httpRequester,
    overridePermissions: params.overridePermissions,
  });
}

export type { SelectOptions } from './types';
