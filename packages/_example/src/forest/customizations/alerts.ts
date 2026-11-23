import type { AlertsCustomizer } from '../typings';

import { randomUUID } from 'crypto';

import { demoFields } from '../../connections/data-model';
import {
  DAY_IN_MS,
  and,
  coll,
  daysFromNow,
  freezeAccount,
  history,
  nextReference,
  now,
  readable,
  unfreezeAccount,
} from '../case-helpers';
import { addQueues } from '../queues';

const STALE_AFTER_DAYS = 7;
const INVESTIGATION_DEADLINE_IN_DAYS = 30;
const HIGH_SCORE = 85;
export const PENDING_STATUSES = ['OPEN', 'IN_REVIEW', 'SECOND_LOOK'];
const CLOSED_STATUSES = ['CLEARED', 'ESCALATED'];
const INVESTIGATION_TYPES = { AML: 'AML', FRAUD: 'FRAUD', ACCOUNT_TAKEOVER: 'ACCOUNT_TAKEOVER' };
const INVESTIGATION_PRIORITIES = demoFields('investigations').find(
  field => field.name === 'priority',
).enum;
const CLEARANCE_REASONS = demoFields('alerts').find(
  field => field.name === 'clearance_reason',
).enum;
const CLEAR_NOTES = {
  STRUCTURING: 'The deposits match the customer’s usual cash activity: no sign of splitting.',
  RAPID_MOVEMENT: 'Money in and out matches a known pattern (salary, then rent and savings).',
  UNUSUAL_VOLUME: 'The higher volume is explained by the customer’s declared profile.',
  HIGH_RISK_COUNTRY: 'The payment to a high-risk country is a known family transfer.',
  SANCTIONS_MATCH: 'Homonym: the name matches, the date of birth and country do not.',
  SUSPICIOUS_PATTERN: 'Reviewed the pattern: consistent with the customer’s declared activity.',
  CARD_TESTING: 'The small card payments were made by the customer (confirmed in the app).',
  UNUSUAL_CARD_SPEND: 'The customer confirmed the card payments (travel abroad).',
  NEW_DEVICE_NEW_PAYEE: 'The customer confirmed the new phone and the new payee.',
  IMPOSSIBLE_TRAVEL: 'The two logins come from a VPN the customer uses: not two places.',
  MULE_PATTERN: 'The incoming transfers are explained (shared flat, refunds from friends).',
  INCOMING_FRAUD_RECALL: 'The sender’s bank withdrew its recall.',
  CUSTOMER_REPORT: 'The customer recognised the payment after all.',
  REPEATED_DISPUTES: 'The disputes were justified: merchant issues, not abuse.',
  INVOICE_IBAN_CHANGE: 'The supplier confirmed its new IBAN by phone, on the number on file.',
};
const CLEAR_REASONS = {
  SANCTIONS_MATCH: 'FALSE_POSITIVE',
  IMPOSSIBLE_TRAVEL: 'FALSE_POSITIVE',
  CARD_TESTING: 'VERIFIED_WITH_COUNTERPARTY',
  UNUSUAL_CARD_SPEND: 'VERIFIED_WITH_COUNTERPARTY',
  NEW_DEVICE_NEW_PAYEE: 'VERIFIED_WITH_COUNTERPARTY',
  INVOICE_IBAN_CHANGE: 'VERIFIED_WITH_COUNTERPARTY',
  CUSTOMER_REPORT: 'VERIFIED_WITH_COUNTERPARTY',
  INCOMING_FRAUD_RECALL: 'ALREADY_INVESTIGATED',
};
const CALL_FIELDS = ['alert_type', 'call_outcome', 'called_at'];
const FREEZE_REASONS = demoFields('accounts').find(field => field.name === 'freeze_reason').enum;
const ALERT_FIELDS = ['id', 'reference', 'status', 'customer_id', 'category'];

async function liveAlert(context) {
  const alert = await context.getRecord(ALERT_FIELDS);
  const closed = CLOSED_STATUSES.includes(alert.status);

  return {
    alert,
    error: closed ? `${alert.reference} is ${alert.status.toLowerCase()} already.` : null,
  };
}

async function moveAlert(context, alert, status: string, reason: string | null, values = {}) {
  await context.collection.update(context.filter, { status, ...values });
  await history(context, 'ALERTS', alert.id, [alert.status, status], reason);
}

async function startReview(context, resultBuilder) {
  const { alert, error } = await liveAlert(context);
  if (error) return resultBuilder.error(error);

  if (alert.status === 'SECOND_LOOK') {
    return resultBuilder.error(`${alert.reference} waits for a senior's second look.`);
  }

  const { email } = context.caller;

  if (alert.status === 'OPEN') {
    await moveAlert(context, alert, 'IN_REVIEW', null, { assigned_to: email });
  } else {
    await context.collection.update(context.filter, { assigned_to: email });
  }

  return resultBuilder.success(`${alert.reference} is in review, assigned to ${email}.`);
}

async function sendForSecondLook(context, resultBuilder) {
  const { alert, error } = await liveAlert(context);
  if (error) return resultBuilder.error(error);

  if (alert.status === 'SECOND_LOOK') {
    return resultBuilder.error(`${alert.reference} already waits for a second look.`);
  }

  const reason = context.formValues.Reason || 'Not sure the profile explains it';
  await moveAlert(context, alert, 'SECOND_LOOK', reason, { assigned_to: null });

  return resultBuilder.success(
    `${alert.reference} waits for a senior's second look, out of the alert queues: ${reason}.`,
  );
}

const confirmedByPhone = alert => alert.call_outcome === 'CONFIRMED' && alert.called_at;

async function defaultClearReason(context) {
  const alert = await context.getRecord(CALL_FIELDS);
  if (confirmedByPhone(alert)) return 'VERIFIED_WITH_COUNTERPARTY';

  return CLEAR_REASONS[alert.alert_type] || 'EXPLAINED_BY_PROFILE';
}

async function defaultClearNote(context) {
  const alert = await context.getRecord(CALL_FIELDS);
  if (confirmedByPhone(alert)) return 'The customer confirmed on the phone.';

  if (alert.call_outcome === 'NOT_REACHED' && alert.alert_type === 'IMPOSSIBLE_TRAVEL') {
    return 'Customer abroad, not reached: the login came from their usual phone and no money moved.';
  }

  return CLEAR_NOTES[alert.alert_type] || 'Reviewed: no suspicious activity found.';
}

async function clearAlert(context, resultBuilder) {
  const { alert, error } = await liveAlert(context);
  if (error) return resultBuilder.error(error);

  const { 'Clearance reason': reason, Note: note } = context.formValues;
  await moveAlert(context, alert, 'CLEARED', note || reason, {
    resolved_at: now(),
    clearance_reason: reason,
    resolution_notes: note || null,
    reviewed_by: context.caller.email,
  });

  return resultBuilder.success(
    `${alert.reference} cleared (${readable(reason)}): it leaves the alert queues.`,
  );
}

async function mainAccount(context, customerId: string) {
  const [account] = await coll(context, 'accounts').list(
    {
      ...and(
        { field: 'customer_id', operator: 'Equal', value: customerId },
        { field: 'type', operator: 'NotEqual', value: 'SAVINGS' },
        { field: 'status', operator: 'NotEqual', value: 'CLOSED' },
      ),
      sort: [{ field: 'opened_at', ascending: true }],
    },
    ['id', 'iban', 'status', 'freeze_reason'],
  );

  return account || null;
}

async function accountOfAlert(context) {
  const alert = await context.getRecord(ALERT_FIELDS);
  const account = await mainAccount(context, alert.customer_id);

  return {
    account,
    error: account ? null : `${alert.reference}: the customer has no open account.`,
  };
}

async function freezeFromAlert(context, resultBuilder) {
  const { account, error } = await accountOfAlert(context);
  if (error) return resultBuilder.error(error);

  const { Reason: reason, Note: note } = context.formValues;

  if (account.status === 'FROZEN') {
    return resultBuilder.success(
      `Account ${account.iban} is frozen already (${readable(
        account.freeze_reason || 'no reason given',
      )}): it stays frozen.`,
    );
  }

  const refused = await freezeAccount(context, account, reason, note);
  if (refused) return resultBuilder.error(refused);

  return resultBuilder.success(
    `Account ${account.iban} frozen (${readable(reason)}): no payment leaves it.`,
  );
}

async function unfreezeFromAlert(context, resultBuilder) {
  const { account, error } = await accountOfAlert(context);
  if (error) return resultBuilder.error(error);

  if (account.status !== 'FROZEN') {
    return resultBuilder.success(`Account ${account.iban} was not frozen: nothing to undo.`);
  }

  if (account.freeze_reason !== 'FRAUD_SUSPICION') {
    return resultBuilder.success(
      `Account ${account.iban} is frozen for ${readable(
        account.freeze_reason || 'another reason',
      )}, not this alert's to lift: it stays frozen.`,
    );
  }

  const refused = await unfreezeAccount(context, account);
  if (refused) return resultBuilder.error(refused);

  return resultBuilder.success(`Account ${account.iban} is active again.`);
}

export default (collection: AlertsCustomizer) =>
  addQueues(collection)
    .removeField('rule_id', 'login_event_id')
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addManyToOneRelation('investigation', 'investigations', { foreignKey: 'investigation_id' })

    .addField('days_open', {
      columnType: 'Number',
      dependencies: ['triggered_at', 'resolved_at', 'escalated_at'],
      getValues: records =>
        records.map(record => {
          const endedAt = record.resolved_at || record.escalated_at;
          const end = endedAt ? new Date(endedAt).getTime() : Date.now();

          return Math.trunc((end - new Date(record.triggered_at).getTime()) / DAY_IN_MS);
        }),
    })
    .removeField('triggered_at', 'resolved_at')
    .emulateFieldSorting('days_open')
    .emulateFieldOperator('days_open', 'GreaterThan')
    .addSegment('Stale alerts', {
      aggregator: 'And',
      conditions: [
        { field: 'status', operator: 'In', value: PENDING_STATUSES },
        { field: 'days_open', operator: 'GreaterThan', value: STALE_AFTER_DAYS },
      ],
    })

    .addAction('Start review', { scope: 'Single', execute: startReview })
    .addAction('Send for a second look', {
      scope: 'Single',
      form: [
        {
          label: 'Reason',
          type: 'String',
          widget: 'TextArea',
          description: 'What you are not sure about: the senior reads it first',
        },
      ],
      execute: sendForSecondLook,
    })
    .addAction('Clear alert', {
      scope: 'Single',
      form: [
        {
          label: 'Clearance reason',
          type: 'Enum',
          enumValues: CLEARANCE_REASONS,
          isRequired: true,
          defaultValue: defaultClearReason,
        },
        {
          label: 'Note',
          type: 'String',
          widget: 'TextArea',
          description: 'Pre-filled from the alert type or the call: adjust it to what you checked',
          defaultValue: defaultClearNote,
        },
      ],
      execute: clearAlert,
    })
    .addAction('Escalate', {
      scope: 'Single',
      form: [
        {
          label: 'Priority',
          type: 'Enum',
          enumValues: INVESTIGATION_PRIORITIES,
          defaultValue: async context => {
            const alert = await context.getRecord(['category', 'score']);
            if (alert.category === 'ACCOUNT_TAKEOVER') return 'URGENT';
            if (alert.category === 'FRAUD') return 'HIGH';

            return Number(alert.score) >= HIGH_SCORE ? 'HIGH' : 'MEDIUM';
          },
        },
        {
          label: 'Summary',
          type: 'String',
          widget: 'TextArea',
          isRequired: true,
          defaultValue: async context => {
            const alert = await context.getRecord([
              'reference',
              'alert_type',
              'customer:display_name',
            ]);
            const what = readable(alert.alert_type).replace(/^./, c => c.toUpperCase());

            return `${what} on ${alert.customer?.display_name}: opened from alert ${alert.reference}.`;
          },
        },
      ],
      execute: async (context, resultBuilder) => {
        const alert = await context.getRecord([
          'id',
          'reference',
          'status',
          'customer_id',
          'category',
        ]);

        if (CLOSED_STATUSES.includes(alert.status)) {
          return resultBuilder.error(
            `${alert.reference} is ${alert.status.toLowerCase()} already.`,
          );
        }

        const investigations = context.dataSource.getCollection('investigations');
        const [open] = await investigations.list(
          {
            conditionTree: {
              aggregator: 'And',
              conditions: [
                { field: 'customer_id', operator: 'Equal', value: alert.customer_id },
                { field: 'status', operator: 'NotEqual', value: 'CLOSED' },
              ],
            },
            sort: [{ field: 'opened_at', ascending: false }],
          },
          ['id', 'reference'],
        );
        const investigation = open ?? {
          id: randomUUID(),
          reference: await nextReference(context, 'investigations', 'INV'),
        };

        if (!open) {
          await investigations.create([
            {
              ...investigation,
              customer_id: alert.customer_id,
              type: INVESTIGATION_TYPES[alert.category] ?? 'AML',
              origin: 'ALERTS',
              status: 'OPEN',
              opened_at: now(),
              due_at: daysFromNow(INVESTIGATION_DEADLINE_IN_DAYS).toISOString(),
              summary: context.formValues.Summary || `Opened from alert ${alert.reference}.`,
              priority: context.formValues.Priority || null,
            },
          ]);
          await history(
            context,
            'INVESTIGATIONS',
            investigation.id,
            [null, 'OPEN'],
            `From ${alert.reference}`,
          );
        }

        await context.collection.update(context.filter, {
          status: 'ESCALATED',
          investigation_id: investigation.id,
          escalated_at: now(),
          reviewed_by: context.caller.email,
        });
        await history(
          context,
          'ALERTS',
          alert.id,
          [alert.status, 'ESCALATED'],
          `To ${investigation.reference}`,
        );
        const how = open ? 'added to the open investigation' : 'escalated to new investigation';

        return resultBuilder.success(`${alert.reference} ${how} ${investigation.reference}.`);
      },
    })
    .addAction('Freeze account', {
      scope: 'Single',
      form: [
        {
          label: 'Reason',
          type: 'Enum',
          enumValues: FREEZE_REASONS,
          isRequired: true,
          defaultValue: 'FRAUD_SUSPICION',
        },
        { label: 'Note', type: 'String' },
      ],
      execute: freezeFromAlert,
    })
    .addAction('Unfreeze account', { scope: 'Single', execute: unfreezeFromAlert });
