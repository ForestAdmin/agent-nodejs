import type {
  ServerAutomatedInboxAssignment,
  ServerAutomatedInboxConfig,
  ServerAutomatedInboxSyncRequest,
} from './server-types';
import type { AutomatedInboxSyncResult, AutomationPort } from '../ports/automation-port';
import type { Logger } from '../ports/logger-port';
import type { HttpOptions } from '@forestadmin/forestadmin-client';

import { ServerUtils } from '@forestadmin/forestadmin-client';

import createConsoleLogger from './console-logger';
import withRetry from './with-retry';
import {
  AutomatedInboxGoneError,
  WorkflowExecutorError,
  WorkflowPortError,
  extractErrorMessage,
} from '../errors';
import {
  ServerAutomatedInboxAssignmentsResponseSchema,
  ServerAutomatedInboxConfigSchema,
  ServerAutomatedInboxSyncResponseSchema,
  ServerAutomatedInboxesResponseSchema,
  ServerAutomationLeaseResponseSchema,
} from './server-types';

const ROUTES = {
  automatedInboxes: (instanceId: string) =>
    `/api/workflow-orchestrator/automated-inboxes?instanceId=${encodeURIComponent(instanceId)}`,
  lease: (instanceId: string) =>
    `/api/workflow-orchestrator/automated-inboxes/lease?instanceId=${encodeURIComponent(
      instanceId,
    )}`,
  assignments: (inboxId: string) =>
    `/api/workflow-orchestrator/automated-inboxes/${encodeURIComponent(inboxId)}/assignments`,
  sync: (inboxId: string) =>
    `/api/workflow-orchestrator/automated-inboxes/${encodeURIComponent(inboxId)}/sync`,
};

// The next heartbeat leaves 15 s after this one ends, and the lease lives 45 s: a heartbeat allowed
// the default 10 s would leave the one after it under 5 s to land.
const HEARTBEAT_TIMEOUT_MS = 5_000;

const AUTOMATION_ROUTE_MISSING =
  'The orchestrator does not serve automated inboxes. Expected while the executor runs ahead of ' +
  'the server; check forestServerUrl if it persists.';

function isNotFound(error: unknown): boolean {
  return (error as { status?: number })?.status === 404;
}

export default class ForestServerAutomationPort implements AutomationPort {
  private readonly options: HttpOptions;
  private readonly logger: Logger;
  private reportedMissingRoute = false;

  constructor(params: { envSecret: string; forestServerUrl: string; logger?: Logger }) {
    this.options = { envSecret: params.envSecret, forestServerUrl: params.forestServerUrl };
    this.logger = params.logger ?? createConsoleLogger();
  }

  async listAutomatedInboxes(instanceId: string): Promise<ServerAutomatedInboxConfig[]> {
    let response: unknown;

    try {
      response = await this.callPort('listAutomatedInboxes', () =>
        ServerUtils.query<unknown>(this.options, 'get', ROUTES.automatedInboxes(instanceId)),
      );
    } catch (error) {
      // An orchestrator that predates automated inboxes has no such route, so this is not an error
      // — but a wrong `forestServerUrl` or a proxy that 404s unknown paths looks exactly the same,
      // and that one never resolves itself.
      if (isNotFound(error)) {
        this.reportMissingRoute(instanceId);

        return [];
      }

      throw error;
    }

    return this.parseConfigs(response, instanceId);
  }

  // Not retried: the poller's next heartbeat is the retry, and backing off here would only widen
  // the gap between two renewals of a lease that lives three heartbeats.
  async holdLease(instanceId: string): Promise<boolean> {
    let response: unknown;

    try {
      response = await ServerUtils.query<unknown>(
        this.options,
        'put',
        ROUTES.lease(instanceId),
        {},
        undefined,
        HEARTBEAT_TIMEOUT_MS,
      );
    } catch (error) {
      // An orchestrator without the heartbeat route still elects on the listing, so the listing
      // decides, as it did before this route existed.
      if (isNotFound(error)) {
        this.reportMissingRoute(instanceId);

        return true;
      }

      throw error;
    }

    return ServerAutomationLeaseResponseSchema.parse(response).held;
  }

  // Said once at Warn so it is visible without becoming a line every heartbeat for the release
  // window this is expected in.
  private reportMissingRoute(instanceId: string): void {
    this.logger(this.reportedMissingRoute ? 'Debug' : 'Warn', AUTOMATION_ROUTE_MISSING, {
      instanceId,
      forestServerUrl: this.options.forestServerUrl,
    });
    this.reportedMissingRoute = true;
  }

  private parseConfigs(response: unknown, instanceId: string): ServerAutomatedInboxConfig[] {
    const envelope = ServerAutomatedInboxesResponseSchema.safeParse(response);

    if (!envelope.success) {
      this.logger('Error', 'Unreadable automated inbox listing', {
        instanceId,
        forestServerUrl: this.options.forestServerUrl,
        error: envelope.error.message,
      });

      return [];
    }

    const configs: ServerAutomatedInboxConfig[] = [];

    for (const [index, raw] of envelope.data.inboxes.entries()) {
      const parsed = ServerAutomatedInboxConfigSchema.safeParse(raw);

      // One unreadable config must not blind the poller to the others: a contract the executor is
      // too old to understand is the expected reason, and the rest of the environment still runs.
      if (parsed.success) {
        configs.push(parsed.data);
      } else {
        this.logger('Warn', 'Skipping an automated inbox config the executor cannot read', {
          index,
          inboxId: (raw as { inboxId?: unknown })?.inboxId,
          error: parsed.error.message,
        });
      }
    }

    return configs;
  }

  async listAssignments(inboxId: string): Promise<ServerAutomatedInboxAssignment[]> {
    const response = await this.callPort(
      'listAutomatedInboxAssignments',
      () => ServerUtils.query<unknown>(this.options, 'get', ROUTES.assignments(inboxId)),
      inboxId,
    );

    // Thrown, not swallowed: an empty list here is indistinguishable from an inbox with nothing
    // assigned, and the sweep would propose every record in the segment as a fresh candidate.
    return ServerAutomatedInboxAssignmentsResponseSchema.parse(response).assignments;
  }

  async sync(
    inboxId: string,
    body: ServerAutomatedInboxSyncRequest,
  ): Promise<AutomatedInboxSyncResult[]> {
    const response = await this.callPort(
      'syncAutomatedInbox',
      () => ServerUtils.query<unknown>(this.options, 'post', ROUTES.sync(inboxId), {}, body),
      inboxId,
    );

    const envelope = ServerAutomatedInboxSyncResponseSchema.safeParse(response);

    // The sync landed and the runs it asked for have already started; only the answer is unreadable.
    // Thrown here it would surface as `Automated inbox poll failed`, which an operator reads as the
    // sync never reaching the orchestrator — the opposite of what happened.
    if (!envelope.success) {
      this.logger('Error', 'Unreadable automated inbox sync response, the sync itself landed', {
        inboxId,
        error: envelope.error.message,
      });

      return [];
    }

    return envelope.data.results;
  }

  private async callPort<T>(operation: string, fn: () => Promise<T>, inboxId?: string): Promise<T> {
    try {
      return await withRetry(operation, fn, { logger: this.logger });
    } catch (cause) {
      // A 404 means two different things here, so it is never wrapped: on an inbox route the
      // orchestrator has stopped serving that inbox, on the listing it has no such route at all.
      if (isNotFound(cause)) {
        if (inboxId !== undefined) throw new AutomatedInboxGoneError(inboxId);

        throw cause;
      }

      if (cause instanceof WorkflowExecutorError) throw cause;

      this.logger('Error', `Automation port "${operation}" failed`, {
        inboxId,
        error: extractErrorMessage(cause),
      });

      throw new WorkflowPortError(operation, cause);
    }
  }
}
