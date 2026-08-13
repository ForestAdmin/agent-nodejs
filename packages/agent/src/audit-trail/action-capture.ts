import type { AuditRecord, AuditSink } from './types';
import type { Caller } from '@forestadmin/datasource-toolkit';

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

export type ActionCaptureParams = {
  caller: Caller;
  collection: string;
  formValues: Record<string, unknown>;
  recordIds: string[];
  failed?: boolean;
};

// Records smart-action invocations into the same store as the field-level history. The Create/Update/
// Delete hooks (instrument.ts) cannot see them: an action's writes are only audited when they go
// through the Forest data layer, so a direct write inside the action's own `execute()` is invisible
// and never recorded. What lands here is the invocation itself — on which records, with which form
// values, and whether it raised. Which action it was lives in the Forest activity logs; `correlationKey`
// is the join.
export default async function captureAction(
  sink: AuditSink,
  redactedFields: string[],
  params: ActionCaptureParams,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const newValues = redactValues(params.formValues ?? {}, redactedFields);
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
        previousValues: {},
        newValues,
      };

      return sink(record);
    }),
  );
}
