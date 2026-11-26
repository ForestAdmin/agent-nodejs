import type { ActivityLogOptions } from './activity-log/with-activity-log';
import type { ActionEndpointsByCollection } from './domains/action';
import type {
  CollectionPermissionsOverride,
  PermissionsOverride,
  SmartActionPermissionsOverride,
} from './domains/remote-agent-client';
import type { ForestServerConnection } from './forest-server';

import ActionFieldJson from './action-fields/action-field-json';
import ActionFieldStringList from './action-fields/action-field-string-list';
import { toActivityLogContext } from './activity-log/with-activity-log';
import makeCreateApprovalRequest from './approval-request-creator';
import RemoteAgentClient from './domains/remote-agent-client';
import AgentHttpError, {
  ActionFormValidationError,
  ActionOutcomeUnknownError,
  ActionRequiresApprovalError,
  ActivityLogBlockedError,
  AgentTimeoutError,
  ApprovalRequestCreationError,
  InvalidActionFileValueError,
  UnknownActionFieldError,
} from './errors';
import HttpRequester from './http-requester';

export {
  ActionFieldJson,
  ActionFieldStringList,
  makeCreateApprovalRequest,
  RemoteAgentClient,
  HttpRequester,
  AgentHttpError,
  ActionRequiresApprovalError,
  ActionFormValidationError,
  ActionOutcomeUnknownError,
  ActivityLogBlockedError,
  AgentTimeoutError,
  ApprovalRequestCreationError,
  InvalidActionFileValueError,
  UnknownActionFieldError,
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
  forestServer?: ForestServerConnection;
  /** Default timezone sent on every agent request. Defaults to `Europe/Paris`. */
  timezone?: string;
  httpRequester?: HttpRequester;
  activityLog?: ActivityLogOptions;
}) {
  const { forestServer, activityLog } = params;

  if (activityLog && !forestServer) {
    throw new Error('An activity log needs the Forest server connection it is written to');
  }

  const httpRequester =
    params.httpRequester ??
    new HttpRequester(params.token, { url: params.url, timezone: params.timezone });

  return new RemoteAgentClient({
    actionEndpoints: params.actionEndpoints,
    httpRequester,
    overridePermissions: params.overridePermissions,
    activityLog: activityLog && toActivityLogContext({ forestServer, activityLog }),
    createApprovalRequest: forestServer
      ? makeCreateApprovalRequest({
          forestServerUrl: forestServer.serverUrl,
          forestServerToken: forestServer.serverToken,
          renderingId: forestServer.renderingId,
          source: activityLog?.source,
        })
      : undefined,
  });
}

export { default as toAgentTokenClaims } from './agent-token-claims';
export type { AgentTokenClaims, AgentTokenUser } from './agent-token-claims';
export { extractErrorDetail } from './domains/action';
export { default as classifyAgentError, mayHaveRun } from './agent-error';
export {
  default as InProcessHttpRequester,
  AGENT_DISPATCH_TIMEOUT_CODE,
  IN_PROCESS_AGENT_URL,
} from './in-process-http-requester';
export { InProcessStreamingUnsupportedError } from './errors';
export type {
  AgentDispatcher,
  AgentDispatchRequest,
  AgentDispatchResponse,
} from './in-process-http-requester';
export type { AgentErrorClassification, AgentFailureKind } from './agent-error';
export { default as toWireFilter, toWireOperator } from './filter-wire-format';
export { default as relationTargetOf } from './schema/relation-target';
export type { RelationTarget } from './schema/relation-target';
export { default as actionEndpointsFromSchema } from './schema/action-endpoints';
export type { SchemaAction, SchemaCollectionWithActions } from './schema/action-endpoints';
export { default as serializeRecordId, deserializeRecordId } from './record-id';
export { default as recordKey, groupByRecordKey, publishedRecordKeys } from './record-key';
export type { PublishedRecordKey } from './record-key';
export type { RecordId, SelectOptions } from './types';
export type { ActionExecuteResult } from './domains/action';
export type { default as Action } from './domains/action';
export type { ExecuteActionOptions } from './domains/collection';
export type { ActivityLogBlockedReason } from './errors';
export { isApprovalRequested } from './approval-requested';
export type { ApprovalRequestedResult } from './approval-requested';
export { withActivityLog, drainActivityLogs } from './activity-log/with-activity-log';
export type {
  ActivityLogCallOptions,
  ActivityLogConfig,
  ActivityLogEntry,
  ActivityLogLogger,
  ActivityLogOptions,
} from './activity-log/with-activity-log';
export { ActivityLogSource } from './forest-server';
export type { ForestServerConnection, ForestServerToken } from './forest-server';
export type { File } from '@forestadmin/datasource-toolkit';
