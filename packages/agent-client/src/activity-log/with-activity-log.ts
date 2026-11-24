import type {
  ActivityLogCallOptions,
  ActivityLogConfig,
  ActivityLogContext,
  ActivityLogEntry,
  DerivedActivityLogEntry,
} from './types';

import { ActivityLogsService, ForestHttpApi } from '@forestadmin/forestadmin-client';

import processDrainer from './activity-log-drainer';
import createPendingActivityLog from './create-pending-activity-log';
import markActivityLog from './mark-activity-log';
import { describeCause, silentLogger } from './shared';
import { isApprovalRequested } from '../approval-requested';
import { ActionRequiresApprovalError, ApprovalRequestCreationError } from '../errors';
import { APPLICATION_SOURCE_HEADER, resolveServerToken } from '../forest-server';

export type {
  ActivityLogCallOptions,
  ActivityLogConfig,
  ActivityLogContext,
  ActivityLogCredentials,
  ActivityLogEntry,
  ActivityLogLevel,
  ActivityLogLogger,
  ActivityLogOptions,
  DerivedActivityLogEntry,
} from './types';

function isApprovalOutcome(error: unknown): boolean {
  return (
    error instanceof ActionRequiresApprovalError || error instanceof ApprovalRequestCreationError
  );
}

async function runAudited<T>(
  context: ActivityLogContext,
  entry: ActivityLogEntry,
  operation: () => Promise<T>,
  beforeCall?: () => Promise<void>,
): Promise<T> {
  const pending = await createPendingActivityLog(context, entry);

  try {
    if (beforeCall) await beforeCall();
    const result = await operation();

    if (pending) {
      markActivityLog(
        context,
        pending,
        entry.action === 'action' && isApprovalRequested(result) ? 'canceled' : 'completed',
      );
    }

    return result;
  } catch (error) {
    if (pending) {
      markActivityLog(context, pending, isApprovalOutcome(error) ? 'canceled' : 'failed');
    }

    throw error;
  }
}

function describeOperation({ action, collectionName }: ActivityLogEntry): string {
  return collectionName ? `'${action}' request on '${collectionName}'` : `'${action}' request`;
}

export default async function withActivityLogContext<T>(
  context: ActivityLogContext | undefined,
  entry: ActivityLogEntry | null,
  operation: () => Promise<T>,
  beforeCall?: () => Promise<void>,
): Promise<T> {
  if (!context || !entry) {
    if (beforeCall) await beforeCall();

    return operation();
  }

  return processDrainer.track(
    () => runAudited(context, entry, operation, beforeCall),
    describeOperation(entry),
  );
}

export function logApprovalRequest(
  context: ActivityLogContext | undefined,
  entry: Omit<ActivityLogEntry, 'action'>,
): void {
  if (!context) return;

  processDrainer
    .track(async () => {
      const pending = await createPendingActivityLog(context, {
        ...entry,
        action: 'createApproval',
      });

      if (pending) markActivityLog(context, pending, 'completed');
    }, describeOperation({ ...entry, action: 'createApproval' }))
    .catch(error => {
      (context.logger ?? silentLogger)(
        'Error',
        'The approval request was filed, but its activity log could not be written',
        { collectionName: entry.collectionName, cause: describeCause(error) },
      );
    });
}

export function resolveEntry(
  derived: DerivedActivityLogEntry,
  call?: ActivityLogCallOptions,
): ActivityLogEntry | null {
  const action = call?.action ?? derived.action;

  if (!action) return null;

  return { ...derived, action, label: call?.label ?? derived.label };
}

export function runCall<T>(
  context: ActivityLogContext | undefined,
  derived: DerivedActivityLogEntry,
  call: ActivityLogCallOptions | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  return withActivityLogContext(context, resolveEntry(derived, call), operation, call?.beforeCall);
}

export function toActivityLogContext({
  forestServer,
  activityLog: { source, ...options },
}: ActivityLogConfig): ActivityLogContext {
  return {
    ...options,
    service: new ActivityLogsService(new ForestHttpApi(), {
      forestServerUrl: forestServer.serverUrl,
      headers: { [APPLICATION_SOURCE_HEADER]: source },
    }),
    credentials: async () => ({
      forestServerToken: await resolveServerToken(forestServer.serverToken),
      renderingId: forestServer.renderingId,
    }),
  };
}

export function withActivityLog<T>(
  config: ActivityLogConfig | undefined,
  entry: ActivityLogEntry | null,
  operation: () => Promise<T>,
  beforeCall?: () => Promise<void>,
): Promise<T> {
  return withActivityLogContext(
    config && toActivityLogContext(config),
    entry,
    operation,
    beforeCall,
  );
}

export function drainActivityLogs(timeoutMs?: number): Promise<string[]> {
  return processDrainer.drain(timeoutMs);
}
