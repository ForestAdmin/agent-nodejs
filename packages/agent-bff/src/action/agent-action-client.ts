import type { ActionEndpointsByCollection } from '@forestadmin/agent-client';
import type { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

export interface ActionFormField {
  getName(): string;
  getType(): string;
  getValue(): unknown;
  isRequired(): boolean | undefined;
}

// Structural subset of agent-client's `Action` the form endpoint consumes. Kept local so the BFF
// does not depend on agent-client exporting the concrete `Action` type (see extractRawLayout).
export interface ActionForm {
  tryToSetFields(values: Record<string, unknown>): Promise<string[]>;
  getFields(): ActionFormField[];
  getEnumField(name: string): { getOptions(): string[] | undefined };
  getLayout(): unknown;
}

// The form and execute endpoints load the same agent-client `Action` object; execute adds the
// strict setFields + execute members on top of the form ones.
export interface Action extends ActionForm {
  setFields(values: Record<string, unknown>): Promise<void>;
  execute(): Promise<unknown>;
}

export interface AgentActionClient {
  loadAction(collection: string, action: string, recordIds: string[]): Promise<Action>;
}

export interface AgentActionClientOptions {
  agentUrl: string;
  token: string;
  actionEndpoints: ActionEndpointsByCollection;
}

// The raw layout must be read AFTER tryToSetFields: a change hook rebuilds fields+layout in place.
// agent-client's `Action.getLayout()` only returns an `ActionLayoutRoot` wrapper whose element array
// lives in a protected field. The rollback contract forbids agent-client changes, so we read it
// through a cast rather than adding a public accessor. A layout-shape test guards against drift.
export function extractRawLayout(action: ActionForm): ForestServerActionFormLayoutElement[] {
  const root = action.getLayout() as { layout?: ForestServerActionFormLayoutElement[] };

  return root.layout ?? [];
}

/**
 * Thin action-form client bound to a request's agent token. Reuses agent-client's stateful form
 * loading (`/hooks/load` + `/hooks/change`, Ruby 404 fallback, dependent-field re-evaluation) rather
 * than reimplementing it. The endpoint map from the read-model is the action allow-list.
 */
export default function createAgentActionClient({
  agentUrl,
  token,
  actionEndpoints,
}: AgentActionClientOptions): AgentActionClient {
  const client = createRemoteAgentClient({ url: agentUrl, token, actionEndpoints });

  return {
    loadAction: (collection, action, recordIds) =>
      client.collection(collection).action(action, { recordIds }),
  };
}
