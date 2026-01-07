import { ActionEndpointsByCollection } from './domains/action';
import RemoteAgentClient, { PermissionsOverride } from './domains/remote-agent-client';
import HttpRequester from './http-requester';
import { TestableAgentOptions } from '../integrations';

// eslint-disable-next-line import/prefer-default-export
export function createRemoteAgentClient(
  params: {
    overridePermissions?: (permissions: PermissionsOverride) => Promise<void>;
    actionEndpoints?: ActionEndpointsByCollection;
    token?: string;
    url: string;
  },
  agentOptions: TestableAgentOptions,
) {
  const httpRequester = new HttpRequester(params.token, { url: params.url }, agentOptions);

  return new RemoteAgentClient({
    actionEndpoints: params.actionEndpoints,
    httpRequester,
    overridePermissions: params.overridePermissions,
  });
}
