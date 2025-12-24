import type { ActionEndpointsByCollection } from './domains/action';
import type { PermissionsOverride } from './domains/remote-agent-client';

import RemoteAgentClient from './domains/remote-agent-client';
import HttpRequester from './http-requester';

// eslint-disable-next-line import/prefer-default-export
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
