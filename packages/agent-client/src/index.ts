import type { ActivityLogOptions } from './activity-log/with-activity-log';
import type { ActionEndpointsByCollection } from './domains/action';
import type {
  CollectionPermissionsOverride,
  PermissionsOverride,
  SmartActionPermissionsOverride,
} from './domains/remote-agent-client';
import type { ForestServerConnection } from './forest-server';
import type { AgentDispatcher } from './in-process-http-requester';
import type { SchemaCollection } from './schema/agent-schema';

import { toActivityLogContext } from './activity-log/with-activity-log';
import makeCreateApprovalRequest from './approval-request-creator';
import RemoteAgentClient from './domains/remote-agent-client';
import AgentHttpError, {
  ActionFormValidationError,
  ActionOutcomeUnknownError,
  ActionRequiresApprovalError,
  ActionValuesNotExecutableError,
  ActivityLogBlockedError,
  AgentCallError,
  AgentTimeoutError,
  AgentUnreachableError,
  ApprovalRequestCreationError,
  InvalidActionFileValueError,
  UnknownActionFieldError,
} from './errors';
import HttpRequester from './http-requester';
import InProcessHttpRequester from './in-process-http-requester';
import agentSchemaOf from './schema/agent-schema';

export {
  RemoteAgentClient,
  HttpRequester,
  AgentHttpError,
  ActionRequiresApprovalError,
  ActionFormValidationError,
  ActionOutcomeUnknownError,
  ActionValuesNotExecutableError,
  ActivityLogBlockedError,
  AgentCallError,
  AgentTimeoutError,
  AgentUnreachableError,
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

function requesterOf(params: {
  token?: string;
  url?: string;
  dispatcher?: AgentDispatcher;
  timeoutMs?: number;
  timezone?: string;
}): HttpRequester {
  const { token, url, dispatcher, timeoutMs, timezone } = params;

  if (dispatcher) {
    return new InProcessHttpRequester(token, dispatcher, { timezone, defaultTimeoutMs: timeoutMs });
  }

  if (!url) throw new Error('An agent client needs the agent url or an in-process dispatcher');

  return new HttpRequester(token, { url, timezone, defaultTimeoutMs: timeoutMs });
}

export function createRemoteAgentClient(params: {
  overridePermissions?: (permissions: PermissionsOverride) => Promise<void>;
  schema?: readonly SchemaCollection[];
  token?: string;
  url?: string;
  dispatcher?: AgentDispatcher;
  timeoutMs?: number;
  /**
   * Connection to the Forest Admin server. Provide it to enable server-side features that call the
   * Forest server (e.g. creating approval requests); omit it for a client that only talks to the
   * agent (e.g. tests). `serverUrl` is the Forest server, distinct from the agent `url` above.
   */
  forestServer?: ForestServerConnection;
  /** Default timezone sent on every agent request. Defaults to `Europe/Paris`. */
  timezone?: string;
  activityLog?: ActivityLogOptions;
}) {
  const { forestServer, activityLog } = params;

  if (activityLog && !forestServer) {
    throw new Error('An activity log needs the Forest server connection it is written to');
  }

  const httpRequester = requesterOf(params);

  return new RemoteAgentClient({
    schema: params.schema && agentSchemaOf(params.schema),
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
export { AGENT_DISPATCH_TIMEOUT_CODE, IN_PROCESS_AGENT_URL } from './in-process-http-requester';
export { InProcessStreamingUnsupportedError } from './errors';
export type {
  AgentDispatcher,
  AgentDispatchRequest,
  AgentDispatchResponse,
} from './in-process-http-requester';
export type { AgentFailureKind } from './errors';
export { default as toWireFilter, toWireOperator } from './filter-wire-format';
export type { RelationTarget } from './schema/relation-target';
export { default as agentSchemaOf } from './schema/agent-schema';
export type {
  AgentSchema,
  AgentSchemaCollection,
  SchemaActions,
  SchemaCollection,
  SchemaField,
} from './schema/agent-schema';
export type { SchemaAction, SchemaCollectionWithActions } from './schema/action-endpoints';
export { default as serializeRecordId, deserializeRecordId } from './record-id';
export { default as recordKey, groupByRecordKey, publishedRecordKeys } from './record-key';
export type { PublishedRecordKey } from './record-key';
export type { RecordId, SelectOptions } from './types';
export type { ActionExecuteResult } from './domains/action';
export type { InvalidActionValue } from './action-fields/action-values-check';
export { enumOptionsOf, normalizeFieldType, primitiveShapeOf } from './schema/field-type';
export type { FieldType, PrimitiveShape } from './schema/field-type';
export type {
  ActionFormDescription,
  ActionFormFieldDescription,
  AllowedValue,
} from './action-fields/form-description';
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
