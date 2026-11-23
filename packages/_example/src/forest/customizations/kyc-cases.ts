import type { KycCasesCustomizer } from '../typings';

import { languageAction } from './customers';
import { demoFields } from '../../connections/data-model';
import { DAY_IN_MS, history, now, one, patch } from '../case-helpers';
import { addQueues } from '../queues';

type UploadedFile = { name: string; mimeType: string; buffer: Buffer };

const DECIDED_STATUSES = ['APPROVED', 'REJECTED'];
const REJECTION_CODES = demoFields('kyc_cases').find(field => field.name === 'rejection_code').enum;
const REVIEW_YEARS = { LOW: 3, MEDIUM: 2, HIGH: 1 };
const DAYS_IN_A_YEAR = 365;
const KYC_FIELDS = ['_id', 'reference', 'status', 'type', 'customer_id', 'assigned_to'];

const isRejection = ctx => ctx.formValues.Decision === 'REJECTED';
const customerStatusAfterRejection = (code: string) =>
  code === 'NO_RESPONSE' ? 'PROSPECT' : 'DECLINED';

async function moveCase(context, kyc, status: string, reason: string, values = {}) {
  if (kyc.status === status) return;
  await context.collection.update(context.filter, { status, updated_at: now(), ...values });
  await history(context, 'KYC_CASES', kyc.id, [kyc.status, status], reason);
}

async function openCase(context) {
  const { _id: id, ...fields } = await context.getRecord(KYC_FIELDS);
  const kyc = { id, ...fields };

  if (DECIDED_STATUSES.includes(kyc.status)) {
    return { kyc, error: `${kyc.reference} is ${kyc.status.toLowerCase()} already.` };
  }

  const me = context.caller.email;
  const assignment = kyc.assigned_to !== me ? { assigned_to: me } : {};

  if (kyc.status === 'OPEN') {
    await moveCase(context, kyc, 'IN_REVIEW', `Review started by ${me}`, assignment);
  } else if (assignment.assigned_to) {
    await context.collection.update(context.filter, { ...assignment, updated_at: now() });
  }

  if (assignment.assigned_to) {
    await history(
      context,
      'KYC_CASES',
      kyc.id,
      [kyc.assigned_to, me],
      kyc.assigned_to ? `Taken over from ${kyc.assigned_to}` : 'Case taken',
      'assigned_to',
    );
  }

  return { kyc: { ...kyc, status: kyc.status === 'OPEN' ? 'IN_REVIEW' : kyc.status }, error: null };
}

async function sendForSignoff(context, resultBuilder) {
  const { kyc, error } = await openCase(context);
  if (error) return resultBuilder.error(error);

  const reason = context.formValues.Reason || 'Medium or high risk: senior sign-off';
  await moveCase(context, kyc, 'PENDING_APPROVAL', reason, {
    escalated_at: now(),
    escalation_reason: reason,
  });

  return resultBuilder.success(
    `${kyc.reference} waits for a senior's sign-off, out of the onboarding queue: ${reason}.`,
  );
}

async function onboardingOutcome(context, kyc, decision: string, code: string, reason: string) {
  const customer = await one(context, 'customers', kyc.customer_id, [
    'id',
    'status',
    'risk_rating',
  ]);
  if (kyc.type !== 'ONBOARDING' || customer?.status !== 'ONBOARDING') return null;

  const status = decision === 'APPROVED' ? 'ACTIVE' : customerStatusAfterRejection(code);
  const reviewYears = REVIEW_YEARS[customer.risk_rating];
  await patch(context, 'customers', customer.id, {
    status,
    updated_at: now(),
    ...(status === 'ACTIVE' && { onboarded_at: now() }),
    ...(status === 'ACTIVE' &&
      reviewYears && {
        next_review_at: new Date(
          Date.now() + reviewYears * DAYS_IN_A_YEAR * DAY_IN_MS,
        ).toISOString(),
      }),
  });
  await history(context, 'CUSTOMERS', customer.id, ['ONBOARDING', status], reason);

  return status;
}

export default (collection: KycCasesCustomizer) =>
  addQueues(collection)
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })

    .addAction('Approve or reject', {
      scope: 'Single',
      form: [
        { label: 'Decision', type: 'Enum', enumValues: DECIDED_STATUSES, isRequired: true },
        {
          label: 'Rejection code',
          type: 'Enum',
          enumValues: REJECTION_CODES,
          if: isRejection,
          isRequired: isRejection,
        },
        { label: 'Rejection reason', type: 'String', widget: 'TextArea', if: isRejection },
      ],
      execute: async (context, resultBuilder) => {
        const { _id: kycCaseId, ...kycCase } = await context.getRecord([
          '_id',
          'status',
          'reference',
          'type',
          'customer_id',
        ]);

        if (DECIDED_STATUSES.includes(kycCase.status)) {
          return resultBuilder.error(`${kycCase.reference} is already ${kycCase.status}`);
        }

        const decision = context.formValues.Decision;
        const code = context.formValues['Rejection code'];
        const reason = context.formValues['Rejection reason'];
        const decidedAt = now();

        await context.collection.update(context.filter, {
          status: decision,
          decided_by: context.caller.email,
          resolved_at: decidedAt,
          updated_at: decidedAt,
          rejection_code: decision === 'REJECTED' ? code : null,
          rejection_reason: decision === 'REJECTED' ? reason : null,
        });
        await history(context, 'KYC_CASES', kycCaseId, [kycCase.status, decision], reason);
        const customerStatus = await onboardingOutcome(
          context,
          kycCase,
          decision,
          code,
          reason || `${kycCase.reference} ${decision.toLowerCase()}`,
        );

        return resultBuilder.success(
          `${kycCase.reference} ${decision.toLowerCase()}${
            customerStatus ? `: customer onboarding → ${customerStatus.toLowerCase()}` : ''
          }`,
        );
      },
    })
    .addAction('Attach a document', {
      scope: 'Single',
      form: [
        { label: 'Document', type: 'File', isRequired: true },
        { label: 'Extra pages', type: 'FileList' },
        { label: 'Note', type: 'String' },
      ],
      execute: async (context, resultBuilder) => {
        const document = context.formValues.Document as UploadedFile;
        const extras = (context.formValues['Extra pages'] ?? []) as UploadedFile[];

        const describe = (file: UploadedFile) =>
          `${file?.name} (${file?.mimeType}, ${file?.buffer?.length} bytes)`;

        return resultBuilder.success(
          [
            `Received ${describe(document)}`,
            extras.length
              ? `plus ${extras.length}: ${extras.map(describe).join(', ')}`
              : 'no extras',
            `note: ${context.formValues.Note ?? '-'}`,
          ].join(' — '),
        );
      },
    })
    .addAction('Send for senior sign-off', {
      scope: 'Single',
      form: [
        { label: 'Reason', type: 'String', defaultValue: 'Medium or high risk: senior sign-off' },
      ],
      execute: sendForSignoff,
    })
    .addAction(
      'Change preferred language',
      languageAction(async context => (await context.getRecord(['customer_id'])).customer_id),
    );
