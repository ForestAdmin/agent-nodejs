import type { Recorder } from './instrument';
import type { PendingAuditRecord } from './types';
import type { ActionResult, Caller } from '@forestadmin/datasource-toolkit';

import { REDACTED } from './instrument';

// A bulk run over a select-all selection only tells us which ids were *excluded*, and a global
// action targets none at all: naming the targets would mean querying the whole selection, so those
// runs are recorded once, attached to no record, rather than not at all.
const NO_RECORD = '';

const redactValues = (
  values: Record<string, unknown>,
  redactedFields: string[],
): Record<string, unknown> => {
  if (!redactedFields.length) return values;

  const result = { ...values };
  for (const field of redactedFields) if (field in result) result[field] = REDACTED;

  return result;
};

// A Webhook's target URL and a Redirect's path are otherwise untouched user/action-supplied data,
// so either can carry credentials (userinfo) or a signed/one-time token (query string) that must
// not be written permanently to the audit database — only the origin and path are kept. Falls back
// to a plain string split for a relative or otherwise unparseable URL — including one whose userinfo
// itself is what made it unparseable to `new URL` (e.g. an invalid host next to valid credentials),
// which is exactly where such a token would still live.
const sanitizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';

    return parsed.toString();
  } catch {
    return url.split(/[?#]/)[0].replace(/^([a-z][a-z\d+.-]*:\/\/)[^/]*@/i, '$1');
  }
};

// Only a safe summary of the answer is kept: `html` (Success/Error), `invalidated` (Success),
// `headers`/`body` (Webhook, which routinely carry credentials) and a File result's `stream` (file
// bytes don't belong in an audit table) are all dropped. Absent when `execute()` threw rather than
// resolving — there is no answer to summarize.
const summarizeActionResult = (result?: ActionResult): Record<string, unknown> => {
  if (!result) return {};

  const summary: Record<string, unknown> = { type: result.type };

  if ('message' in result) summary.message = result.message;
  if ('name' in result) summary.name = result.name;
  if ('mimeType' in result) summary.mimeType = result.mimeType;
  if ('method' in result) summary.method = result.method;
  if ('url' in result) summary.url = sanitizeUrl(result.url);
  if ('path' in result) summary.path = sanitizeUrl(result.path);

  return summary;
};

export type ActionCaptureParams = {
  caller: Caller;
  collection: string;
  actionName: string;
  formValues: Record<string, unknown>;
  recordIds: string[];
};

// Threads pending ids from `captureActionPending` (called before `execute()` runs) through to
// `captureActionConfirm` (called once it resolves or throws) — one entry per targeted record, or a
// single entry attached to no record for a global/select-all run.
export type PendingActionAudit = {
  pendingIds: Array<number | null>;
  recordIds: string[];
  previousValues: Record<string, unknown>;
};

// Records smart-action invocations into the same store as the field-level history. The Create/Update/
// Delete hooks (instrument.ts) cannot see them: an action's writes are only audited when they go
// through the Forest data layer, so a direct write inside the action's own `execute()` is invisible
// and never recorded. What lands here is the invocation itself — on which records, with the form that
// was submitted and (once confirmed) a summary of what the action answered. Which action ran is
// captured directly (`actionName`), unlike a create/update/delete row.
export async function captureActionPending(
  recorder: Recorder,
  redactedFields: string[],
  params: ActionCaptureParams,
): Promise<PendingActionAudit> {
  const timestamp = new Date().toISOString();
  const previousValues = redactValues(params.formValues ?? {}, redactedFields);
  const recordIds = params.recordIds.length > 0 ? params.recordIds : [NO_RECORD];

  const pendingRecords: PendingAuditRecord[] = recordIds.map(recordId => ({
    timestamp,
    operation: 'action',
    collection: params.collection,
    recordId,
    userId: params.caller.id,
    userFirstName: params.caller.firstName,
    userLastName: params.caller.lastName,
    userEmail: params.caller.email,
    actionName: params.actionName,
    correlationKey: params.caller.requestId,
    previousValues,
    newValues: {},
  }));

  const pendingIds = await recorder.insertPendingBatch(pendingRecords);

  return { pendingIds, recordIds, previousValues };
}

export async function captureActionConfirm(
  recorder: Recorder,
  pending: PendingActionAudit,
  result: ActionResult | undefined,
  failed: boolean,
): Promise<void> {
  const newValues = summarizeActionResult(result);
  const operation = failed ? 'action_failed' : 'action';

  await Promise.all(
    pending.pendingIds.map((pendingId, index) =>
      recorder.confirm(pendingId, {
        operation,
        recordId: pending.recordIds[index],
        previousValues: pending.previousValues,
        newValues,
      }),
    ),
  );
}
