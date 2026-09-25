import type {
  ServerAutomatedInboxAssignment,
  ServerAutomatedInboxConfig,
  ServerAutomatedInboxSyncOutcome,
  ServerAutomatedInboxSyncRequest,
} from '../adapters/server-types';

export interface AutomatedInboxSyncResult {
  recordId: string;
  outcome: ServerAutomatedInboxSyncOutcome | string;
}

/**
 * The orchestrator's automated-inbox endpoints, kept apart from `WorkflowPort`, which is scoped to
 * a single run. Every method is authenticated by the environment secret, never a user session.
 */
export interface AutomationPort {
  /**
   * `instanceId` opts this process into the single-poller election: only the lease holder is served
   * the environment's inboxes, everyone else gets an empty list.
   */
  listAutomatedInboxes(instanceId: string): Promise<ServerAutomatedInboxConfig[]>;
  /** Resolves true on an orchestrator without the lease route: the listing still elects there. */
  holdLease(instanceId: string): Promise<boolean>;
  /** Throws AutomatedInboxGoneError when the orchestrator no longer serves this inbox. */
  listAssignments(inboxId: string): Promise<ServerAutomatedInboxAssignment[]>;
  /** Throws AutomatedInboxGoneError when the orchestrator no longer serves this inbox. */
  sync(inboxId: string, body: ServerAutomatedInboxSyncRequest): Promise<AutomatedInboxSyncResult[]>;
}
