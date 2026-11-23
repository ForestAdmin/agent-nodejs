import type { InvestigationsCustomizer } from '../typings';

import {
  and,
  byId,
  coll,
  daysFromNow,
  digitsOf,
  history,
  isoDate,
  moveTo,
  now,
  one,
  openCase,
  patch,
  readable,
  where,
} from '../case-helpers';
import { addQueues } from '../queues';

const KYC_REVIEW_DEADLINE_IN_DAYS = 30;
const ERMES_DIGITS = 7;
const TRACFIN = 'TRACFIN · ERMES portal';
const DECIDED_KYC = ['APPROVED', 'REJECTED'];
const INVESTIGATION = ['id', 'reference', 'status', 'customer_id', 'summary', 'assigned_to'];

async function openInvestigation(context) {
  const inv = await context.getRecord(INVESTIGATION);

  return inv.status === 'CLOSED' ? [inv, `Investigation ${inv.reference} is closed.`] : [inv, null];
}

async function discardDraftSar(context, inv, reason: string) {
  const drafts = await coll(context, 'sar_reports').list(
    and(
      { field: 'investigation_id', operator: 'Equal', value: inv.id },
      { field: 'status', operator: 'Equal', value: 'DRAFT' },
    ),
    ['id', 'reference'],
  );
  await Promise.all(
    drafts.map(async sar => {
      await coll(context, 'sar_reports').delete(byId(sar.id));
      await history(context, 'SAR_REPORTS', sar.id, ['DRAFT', 'DISCARDED'], reason);
    }),
  );

  return drafts.map(sar => sar.reference);
}

export async function liftAmlFreeze(context, inv, why: string, reason = 'AML_INVESTIGATION') {
  const frozen = await coll(context, 'accounts').list(
    and(
      { field: 'customer_id', operator: 'Equal', value: inv.customer_id },
      { field: 'status', operator: 'Equal', value: 'FROZEN' },
      { field: 'freeze_reason', operator: 'Equal', value: reason },
    ),
    ['id', 'iban'],
  );
  await Promise.all(
    frozen.map(a =>
      patch(context, 'accounts', a.id, {
        status: 'ACTIVE',
        frozen_at: null,
        freeze_reason: null,
        freeze_note: null,
      }),
    ),
  );

  if (frozen.length) {
    const blocked = await coll(context, 'cards').list(
      and(
        { field: 'account_id', operator: 'In', value: frozen.map(a => a.id) },
        { field: 'status', operator: 'Equal', value: 'BLOCKED' },
        { field: 'blocked_reason', operator: 'Equal', value: 'AML_FREEZE' },
        { field: 'expires_at', operator: 'After', value: isoDate(new Date()) },
      ),
      ['id'],
    );
    await Promise.all(
      blocked.map(c =>
        patch(context, 'cards', c.id, { status: 'ACTIVE', blocked_reason: null, blocked_at: null }),
      ),
    );
  }

  const customer = await one(context, 'customers', inv.customer_id, ['id', 'status']);
  const stillFrozen = await coll(context, 'accounts').list(
    and(
      { field: 'customer_id', operator: 'Equal', value: inv.customer_id },
      { field: 'status', operator: 'Equal', value: 'FROZEN' },
    ),
    ['id'],
  );

  if (customer?.status === 'SUSPENDED' && !stillFrozen.length) {
    await patch(context, 'customers', customer.id, { status: 'ACTIVE', updated_at: now() });
    await history(
      context,
      'CUSTOMERS',
      customer.id,
      ['SUSPENDED', 'ACTIVE'],
      `${inv.reference}: ${why}`,
    );
  }

  return frozen.map(a => a.iban);
}

async function closeInvestigation(context, inv, decision: string, reason: string) {
  const dropped =
    decision === 'SAR_FILED'
      ? []
      : await discardDraftSar(context, inv, `Investigation closed: ${readable(decision)}`);
  await moveTo(
    context,
    'INVESTIGATIONS',
    inv,
    'CLOSED',
    { decision, decided_by: context.caller.email, decided_at: now() },
    reason || decision,
  );

  return dropped;
}

const findSar = async (context, investigationId: string, statuses: string[]) =>
  (
    await coll(context, 'sar_reports').list(
      and(
        { field: 'investigation_id', operator: 'Equal', value: investigationId },
        { field: 'status', operator: 'In', value: statuses },
      ),
      ['id', 'reference', 'status'],
    )
  )[0];

const ermesNumber = sar => `ERMES-${new Date().getUTCFullYear()}-${digitsOf(sar.id, ERMES_DIGITS)}`;

async function sarFreeze(context, inv, sar) {
  const accounts = await coll(context, 'accounts').list(where('customer_id', inv.customer_id), [
    'id',
    'iban',
    'status',
    'freeze_reason',
  ]);
  const ours = accounts.filter(
    a =>
      ['ACTIVE', 'DORMANT'].includes(a.status) ||
      (a.status === 'FROZEN' && ['AML_INVESTIGATION', 'FRAUD_SUSPICION'].includes(a.freeze_reason)),
  );
  await Promise.all(
    ours.map(a =>
      patch(context, 'accounts', a.id, {
        status: 'FROZEN',
        frozen_at: now(),
        freeze_reason: 'SAR_FILED',
        freeze_note: `SAR filed: waiting for TRACFIN (${sar.reference})`,
      }),
    ),
  );

  if (ours.length) {
    await coll(context, 'cards').update(
      and(
        { field: 'account_id', operator: 'In', value: ours.map(a => a.id) },
        { field: 'status', operator: 'In', value: ['ACTIVE', 'PENDING'] },
      ),
      { status: 'BLOCKED', blocked_reason: 'AML_FREEZE', blocked_at: now() },
    );
  }

  return ours.map(a => a.iban);
}

async function assign(context, resultBuilder) {
  const [inv, closed] = await openInvestigation(context);
  if (closed) return resultBuilder.error(closed);
  const operator = context.formValues['Operator email'];

  if (inv.status === 'OPEN') {
    await moveTo(context, 'INVESTIGATIONS', inv, 'IN_PROGRESS', { assigned_to: operator });
  } else {
    await context.collection.update(context.filter, { assigned_to: operator });
  }

  return resultBuilder.success(`Investigation ${inv.reference} assigned to ${operator}.`);
}

async function requestDueDiligence(context, resultBuilder) {
  const [inv, closed] = await openInvestigation(context);
  if (closed) return resultBuilder.error(closed);

  if (inv.status === 'PENDING_MLRO') {
    return resultBuilder.error(`Investigation ${inv.reference} is with the MLRO.`);
  }

  const [asked] = await coll(context, 'kyc_cases').list(
    and(
      { field: 'investigation_id', operator: 'Equal', value: inv.id },
      { field: 'status', operator: 'NotIn', value: DECIDED_KYC },
    ),
    ['reference'],
  );
  const customer = await one(context, 'customers', inv.customer_id, ['risk_rating']);
  const kyc =
    asked ||
    (await openCase(
      context,
      'kyc_cases',
      'KYC',
      {
        customer_id: inv.customer_id,
        type: 'EVENT_REVIEW',
        trigger: 'AML_INVESTIGATION',
        status: 'OPEN',
        investigation_id: inv.id,
        risk_before: customer?.risk_rating || null,
        notes: context.formValues.Reason || `Enhanced due diligence asked by ${inv.reference}`,
        opened_at: now(),
        due_at: daysFromNow(KYC_REVIEW_DEADLINE_IN_DAYS).toISOString(),
        updated_at: now(),
      },
      '_id',
    ));

  await moveTo(
    context,
    'INVESTIGATIONS',
    inv,
    'WAITING_INFORMATION',
    {},
    `Waiting for the KYC review ${kyc.reference}`,
  );

  return resultBuilder.success(
    `${kyc.reference} ${asked ? 'was open already' : 'opened'} for the onboarding desk; ${
      inv.reference
    } waits for it, out of the analyst queue.`,
  );
}

async function fileSar(context, resultBuilder) {
  const [inv, closed] = await openInvestigation(context);
  if (closed) return resultBuilder.error(closed);
  const sar = await findSar(context, inv.id, ['DRAFT']);
  if (!sar) return resultBuilder.error('No draft SAR on this case.');
  const declaration = ermesNumber(sar);
  await patch(context, 'sar_reports', sar.id, {
    status: 'SUBMITTED',
    filed_at: now(),
    filed_by: context.caller.email,
    fiu_reference: declaration,
    updated_at: now(),
  });
  await history(
    context,
    'SAR_REPORTS',
    sar.id,
    ['DRAFT', 'SUBMITTED'],
    `Filed with TRACFIN: ${declaration}`,
  );
  await closeInvestigation(context, inv, 'SAR_FILED', `${sar.reference} filed`);
  const frozen = await sarFreeze(context, inv, sar);
  const freeze = frozen.length
    ? ` Frozen until TRACFIN answers: ${frozen.join(', ')}.`
    : ' No open account to freeze.';

  return resultBuilder.success(
    `${sar.reference} filed with ${TRACFIN} (simulated): declaration ${declaration}.${freeze}`,
  );
}

async function sendBack(context, resultBuilder) {
  const [inv, closed] = await openInvestigation(context);
  if (closed) return resultBuilder.error(closed);

  if (inv.status !== 'PENDING_MLRO') {
    return resultBuilder.error(`Investigation ${inv.reference} is not with the MLRO.`);
  }

  const reason = context.formValues.Reason;
  const dropped = await discardDraftSar(context, inv, `Sent back by the MLRO: ${reason}`);
  await moveTo(context, 'INVESTIGATIONS', inv, 'IN_PROGRESS', { sent_to_mlro_at: null }, reason);
  const draft = dropped.length ? ` Draft ${dropped.join(', ')} discarded.` : '';

  return resultBuilder.success(`${inv.reference} is back in the analysts' queue.${draft}`);
}

async function closeWithoutSar(context, resultBuilder) {
  const [inv, closed] = await openInvestigation(context);
  if (closed) return resultBuilder.error(closed);
  await closeInvestigation(context, inv, 'NO_SAR', context.formValues.Reason);
  const lifted = await liftAmlFreeze(context, inv, 'no SAR');
  const freeze = lifted.length ? ` Accounts unfrozen: ${lifted.join(', ')}.` : '';

  return resultBuilder.success(`Investigation ${inv.reference} closed without SAR.${freeze}`);
}

export default (collection: InvestigationsCustomizer) =>
  addQueues(collection)
    .removeField('origin_authority_request_id')
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addManyToOneRelation('origin_kyc_case', 'kyc_cases', { foreignKey: 'origin_kyc_case_id' })
    .addOneToManyRelation('alerts', 'alerts', { originKey: 'investigation_id' })
    .addOneToManyRelation('sar_reports', 'sar_reports', { originKey: 'investigation_id' })

    .addAction('Assign', {
      scope: 'Single',
      form: [
        {
          label: 'Operator email',
          type: 'String',
          isRequired: true,
          defaultValue: context => context.caller.email,
        },
      ],
      execute: assign,
    })
    .addAction('Request enhanced due diligence', {
      scope: 'Single',
      form: [{ label: 'Reason', type: 'String', widget: 'TextArea' }],
      execute: requestDueDiligence,
    })
    .addAction('File SAR', { scope: 'Single', execute: fileSar })
    .addAction('Send back to the analyst', {
      scope: 'Single',
      form: [
        {
          label: 'Reason',
          type: 'String',
          widget: 'TextArea',
          isRequired: true,
          description: 'What the analyst must add or check before the SAR comes back',
        },
      ],
      execute: sendBack,
    })
    .addAction('Close without SAR', {
      scope: 'Single',
      form: [
        {
          label: 'Reason',
          type: 'String',
          widget: 'TextArea',
          isRequired: true,
          description: 'Why no SAR: what explains the activity',
          defaultValue:
            "No suspicion confirmed after review: the activity is explained by the customer's profile.",
        },
      ],
      execute: closeWithoutSar,
    });
