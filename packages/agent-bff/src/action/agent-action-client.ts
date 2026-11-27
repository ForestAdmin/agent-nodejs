import type { AgentTransport } from '../agent/agent-transport';
import type {
  ActionFormDescription,
  ActivityLogConfig,
  SchemaCollection,
} from '@forestadmin/agent-client';
import type { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

// Structural subset of agent-client's `Action` the form endpoint consumes. Kept local so the BFF
// does not depend on agent-client exporting the concrete `Action` type (see extractRawLayout).
export interface ActionForm {
  tryToSetFields(values: Record<string, unknown>): Promise<string[]>;
  describeForm(): ActionFormDescription;
  getLayout(): unknown;
}

// The form and execute endpoints load the same agent-client `Action` object; execute adds the
// strict setFields + execute members on top of the form ones.
export interface Action extends ActionForm {
  setFields(values: Record<string, unknown>): Promise<void>;
  execute(options?: { maxTimeAllowed?: number }): Promise<unknown>;
}

export interface LoadActionParams {
  collection: string;
  actionName: string;
  recordIds: string[];
  timezone: string;
}

export interface ExecuteActionParams extends LoadActionParams {
  approvalRequestMessage?: string;
  maxTimeAllowed?: number;
  beforeCall: () => Promise<void>;
  fill: (action: Action) => Promise<void>;
}

export interface AgentActionClient {
  loadAction(params: LoadActionParams): Promise<Action>;
  executeAction(params: ExecuteActionParams): Promise<unknown>;
}

export interface AgentActionClientOptions {
  transport: AgentTransport;
  token: string;
  schema: readonly SchemaCollection[];
  activityLog?: ActivityLogConfig;
}

// The raw layout must be read AFTER tryToSetFields: a change hook rebuilds fields+layout in place.
// agent-client's `Action.getLayout()` only returns an `ActionLayoutRoot` wrapper whose element array
// lives in a protected field. The rollback contract forbade agent-client changes, so we read it
// through a cast rather than adding a public accessor. `extract-raw-layout.test.ts` builds a real
// `ActionLayoutRoot` and asserts this unwraps it, so a rename of that field fails a test.
export function extractRawLayout(action: ActionForm): ForestServerActionFormLayoutElement[] {
  const root = action.getLayout() as { layout?: ForestServerActionFormLayoutElement[] };

  return Array.isArray(root.layout) ? root.layout : [];
}

/**
 * Thin action-form client bound to a request's agent token. Reuses agent-client's stateful form
 * loading (`/hooks/load` + `/hooks/change`, Ruby 404 fallback, dependent-field re-evaluation) rather
 * than reimplementing it. The endpoint map from the read-model is the action allow-list.
 */
export default function createAgentActionClient({
  transport,
  token,
  schema,
  activityLog,
}: AgentActionClientOptions): AgentActionClient {
  const client = createRemoteAgentClient({
    ...transport,
    token,
    schema,
    ...activityLog,
  });

  return {
    loadAction: ({ collection, actionName, recordIds, timezone }) =>
      client.collection(collection).action(actionName, { recordIds, timezone }),
    executeAction: ({
      collection,
      actionName,
      recordIds,
      timezone,
      approvalRequestMessage,
      maxTimeAllowed,
      beforeCall,
      fill,
    }) =>
      client.collection(collection).executeAction(actionName, {
        recordIds,
        timezone,
        approvalRequestMessage,
        maxTimeAllowed,
        fill,
        activityLog: { beforeCall },
      }),
  };
}
