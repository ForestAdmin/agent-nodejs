import type { AuditRecord, AuditSink } from './types';
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
  formValues: Record<string, unknown>;
  /** Absent when `execute()` threw instead of resolving. */
  result?: ActionResult;
  recordIds: string[];
  failed?: boolean;
};

// Records smart-action invocations into the same store as the field-level history. The Create/Update/
// Delete hooks (instrument.ts) cannot see them: an action's writes are only audited when they go
// through the Forest data layer, so a direct write inside the action's own `execute()` is invisible
// and never recorded. What lands here is the invocation itself — on which records, with the form that
// was submitted and a summary of what the action answered. Which action it was lives in the Forest
// activity logs; `correlationKey` is the join.
export default async function captureAction(
  sink: AuditSink,
  redactedFields: string[],
  params: ActionCaptureParams,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const previousValues = redactValues(params.formValues ?? {}, redactedFields);
  const newValues = summarizeActionResult(params.result);
  const recordIds = params.recordIds.length > 0 ? params.recordIds : [NO_RECORD];

  await Promise.all(
    recordIds.map(recordId => {
      const record: AuditRecord = {
        timestamp,
        operation: params.failed ? 'action_failed' : 'action',
        collection: params.collection,
        recordId,
        userId: params.caller.id,
        correlationKey: params.caller.requestId,
        previousValues,
        newValues,
      };

      return sink(record);
    }),
  );
}
