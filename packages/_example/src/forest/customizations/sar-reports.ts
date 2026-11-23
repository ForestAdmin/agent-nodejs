import type { SarReportsCustomizer } from '../typings';

import { liftAmlFreeze } from './investigations';
import { and, coll, history, now, one, patch, readable } from '../case-helpers';
import { addQueues } from '../queues';

const FILED_STATUSES = ['SUBMITTED', 'ACKNOWLEDGED'];
const TRACFIN_ANSWERS = {
  'Release the accounts': 'RELEASE_ACCOUNTS',
  'Keep them blocked (judicial seizure, prosecutor)': 'KEEP_BLOCKED',
};
const ANSWER_TITLES = {
  RELEASE_ACCOUNTS: 'Accounts released',
  KEEP_BLOCKED: 'Accounts kept blocked',
};
const CHANGED_ACCOUNTS = {
  RELEASE_ACCOUNTS: 'Accounts released',
  KEEP_BLOCKED: 'Kept blocked',
};

async function keepBlocked(context, customerId: string, sar, note: string | null) {
  const frozen = await coll(context, 'accounts').list(
    and(
      { field: 'customer_id', operator: 'Equal', value: customerId },
      { field: 'freeze_reason', operator: 'Equal', value: 'SAR_FILED' },
    ),
    ['id', 'iban'],
  );
  await Promise.all(
    frozen.map(a =>
      patch(context, 'accounts', a.id, {
        freeze_reason: 'AUTHORITY_REQUEST',
        freeze_note: `Kept blocked on TRACFIN's answer to ${sar.reference}${
          note ? `: ${note}` : ''
        }`,
      }),
    ),
  );

  return frozen.map(a => a.iban);
}

async function recordTracfinAnswer(context, resultBuilder) {
  const sar = await context.getRecord([
    'id',
    'reference',
    'status',
    'customer_id',
    'investigation_id',
  ]);

  if (!FILED_STATUSES.includes(sar.status)) {
    return resultBuilder.error(
      `${sar.reference} is ${readable(sar.status)}: only a SAR filed with TRACFIN gets an answer.`,
    );
  }

  const answer = TRACFIN_ANSWERS[context.formValues.Answer];
  const note = context.formValues.Note || null;
  const inv = (await one(context, 'investigations', sar.investigation_id, [
    'id',
    'reference',
    'customer_id',
  ])) || { customer_id: sar.customer_id };
  const changed =
    answer === 'KEEP_BLOCKED'
      ? await keepBlocked(context, sar.customer_id, sar, note)
      : await liftAmlFreeze(context, inv, `TRACFIN answered ${sar.reference}`, 'SAR_FILED');

  await context.collection.update(context.filter, {
    status: 'ANSWERED',
    tracfin_answer: answer,
    tracfin_answered_at: now(),
    tracfin_note: note,
    updated_at: now(),
  });
  await history(
    context,
    'SAR_REPORTS',
    sar.id,
    [sar.status, 'ANSWERED'],
    `TRACFIN: ${readable(answer)}${note ? ` (${note})` : ''}`,
  );
  const accounts = changed.length ? ` ${CHANGED_ACCOUNTS[answer]}: ${changed.join(', ')}.` : '';

  return resultBuilder.success(
    `${sar.reference}: TRACFIN's answer recorded (${ANSWER_TITLES[
      answer
    ].toLowerCase()}).${accounts}`,
  );
}

export default (collection: SarReportsCustomizer) =>
  addQueues(collection)
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addManyToOneRelation('investigation', 'investigations', { foreignKey: 'investigation_id' })

    .addAction('Record TRACFIN answer', {
      scope: 'Single',
      form: [
        {
          label: 'Answer',
          type: 'Enum',
          enumValues: Object.keys(TRACFIN_ANSWERS),
          isRequired: true,
        },
        { label: 'Note', type: 'String', widget: 'TextArea', description: 'What TRACFIN said' },
      ],
      execute: recordTracfinAnswer,
    });
