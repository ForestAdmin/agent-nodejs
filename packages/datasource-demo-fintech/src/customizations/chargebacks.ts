import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';

import { RESOLVED_CHARGEBACK_STATUSES as RESOLVED, byId, now } from './utils';

export default function customizeChargebacks(collection: CollectionCustomizer): void {
  // Relationships
  collection
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addManyToOneRelation('card', 'cards', { foreignKey: 'card_id' })
    .addManyToOneRelation('refundRequest', 'refund_requests', { foreignKey: 'refund_request_id' });

  // Computed fields
  collection.addField('days_to_deadline', {
    columnType: 'Number',
    dependencies: ['representment_deadline', 'status'],
    getValues: records =>
      records.map(r => {
        if (!r.representment_deadline) return null;
        if (RESOLVED.includes(r.status as string)) return null;
        const diffMs = new Date(r.representment_deadline as string).getTime() - Date.now();

        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }),
  });

  collection.addField('is_overdue', {
    columnType: 'Boolean',
    dependencies: ['representment_deadline', 'status'],
    getValues: records =>
      records.map(r => {
        if (!r.representment_deadline) return false;
        if (RESOLVED.includes(r.status as string)) return false;

        return new Date(r.representment_deadline as string).getTime() < Date.now();
      }),
  });

  // Segments
  collection.addSegment('Open', () => ({
    field: 'status',
    operator: 'NotIn',
    value: RESOLVED,
  }));

  collection.addSegment('Overdue', () => ({
    aggregator: 'And',
    conditions: [
      { field: 'status', operator: 'NotIn', value: RESOLVED },
      { field: 'representment_deadline', operator: 'Before', value: now() },
    ],
  }));

  collection.addSegment('Awaiting evidence', () => ({
    aggregator: 'And',
    conditions: [
      { field: 'status', operator: 'Equal', value: 'PRESENTED' },
      { field: 'evidence_submitted_at', operator: 'Missing' },
    ],
  }));

  collection.addSegment('Pre-arbitration & Arbitration', () => ({
    field: 'status',
    operator: 'In',
    value: ['PRE_ARBITRATION', 'ARBITRATION'],
  }));

  // ── Actions ────────────────────────────────────────────────────────────────

  collection.addAction('File with Network', {
    scope: 'Single',
    form: [
      {
        label: 'Evidence URL',
        type: 'String',
        isRequired: true,
        description:
          'Link to the evidence bundle submitted to the network (transaction logs, device fingerprint, cardholder statement, etc.).',
      },
      {
        label: 'Analyst Notes',
        type: 'String',
        description:
          'Internal notes — not transmitted to the network. Visible only to the ops team.',
      },
    ],
    execute: async (context, resultBuilder) => {
      const id = await context.getRecordId();
      const record = await context.getRecord(['status', 'network', 'reason_code']);

      if (record.status !== 'INITIATED') {
        return resultBuilder.error(
          `Cannot file: chargeback is in status ${record.status}. Only INITIATED chargebacks can be filed.`,
        );
      }

      const deadline = new Date();
      deadline.setUTCDate(deadline.getUTCDate() + 45); // Visa/MC representment window

      await context.collection.update(byId(id), {
        status: 'PRESENTED',
        evidence_url: context.formValues['Evidence URL'],
        evidence_submitted_at: now(),
        representment_deadline: deadline.toISOString(),
        analyst_email: context.caller.email,
        updated_at: now(),
      });

      return resultBuilder.success(
        `Filed with ${record.network} (${record.reason_code}). Deadline ${deadline
          .toISOString()
          .slice(0, 10)}.`,
      );
    },
  });

  collection.addAction('Request Cardholder Info', {
    scope: 'Single',
    form: [
      {
        label: 'Information Requested',
        type: 'String',
        isRequired: true,
        description:
          'What do you need from the cardholder? (e.g. proof of purchase, police report reference, screenshots of merchant communication)',
      },
      {
        label: 'Reply Deadline (days)',
        type: 'Enum',
        enumValues: ['3', '5', '7', '14'],
        isRequired: true,
        description: 'How long does the cardholder have to respond?',
      },
    ],
    execute: async (context, resultBuilder) => {
      const id = await context.getRecordId();
      const record = await context.getRecord(['status', 'resolution_notes']);

      if (RESOLVED.includes(record.status as string)) {
        return resultBuilder.error(
          `Cannot send RFI: chargeback already resolved (${record.status}).`,
        );
      }

      const days = parseInt(context.formValues['Reply Deadline (days)'], 10);
      const replyBy = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      const entry = `[RFI ${now().slice(0, 10)} by ${context.caller.email}] Requested: "${
        context.formValues['Information Requested']
      }" — reply by ${replyBy}`;
      const newNotes = record.resolution_notes ? `${record.resolution_notes}\n${entry}` : entry;

      await context.collection.update(byId(id), {
        resolution_notes: newNotes,
        analyst_email: context.caller.email,
        updated_at: now(),
      });

      return resultBuilder.success(`RFI sent to cardholder. Reply expected by ${replyBy}.`);
    },
  });

  collection.addAction('Block Linked Card', {
    scope: 'Single',
    form: [
      {
        label: 'Block Reason',
        type: 'Enum',
        enumValues: ['FRAUD', 'STOLEN', 'LOST', 'AML_FREEZE', 'CUSTOMER_REQUEST'],
        isRequired: true,
      },
    ],
    execute: async (context, resultBuilder) => {
      const card = await context.getRecord([
        'card_id',
        'card:status',
        'card:last_four_digits',
        'card:card_type',
      ]);
      if (!card.card_id) return resultBuilder.error('No card linked to this chargeback.');

      if (card.card?.status === 'BLOCKED') {
        return resultBuilder.error(`Card ••${card.card.last_four_digits} is already blocked.`);
      }

      await context.dataSource.getCollection('cards').update(
        { conditionTree: { field: 'id', operator: 'Equal', value: card.card_id } },
        {
          status: 'BLOCKED',
          blocked_reason: `${context.formValues['Block Reason']} — from chargeback investigation by ${context.caller.email}`,
          blocked_at: now(),
        },
      );

      return resultBuilder.success(
        `${card.card?.card_type} card ••${card.card?.last_four_digits} blocked (${context.formValues['Block Reason']}).`,
      );
    },
  });

  collection.addAction('Accept Liability & Refund Customer', {
    scope: 'Single',
    form: [
      {
        label: 'Reason',
        type: 'String',
        isRequired: true,
        description: 'Why are we accepting liability without contesting?',
      },
    ],
    execute: async (context, resultBuilder) => {
      const id = await context.getRecordId();
      const record = await context.getRecord(['status', 'amount', 'currency']);

      if (RESOLVED.includes(record.status as string)) {
        return resultBuilder.error(`Chargeback already resolved (${record.status}).`);
      }

      await context.collection.update(byId(id), {
        status: 'ACCEPTED',
        decision_at: now(),
        provisional_credit_issued: true,
        resolution_notes: context.formValues.Reason,
        analyst_email: context.caller.email,
        updated_at: now(),
      });

      return resultBuilder.success(
        `Liability accepted. Credit of ${record.amount} ${record.currency} queued for the customer.`,
      );
    },
  });

  collection.addAction('Mark Won', {
    scope: 'Single',
    form: [{ label: 'Resolution Notes', type: 'String', description: 'Network decision summary.' }],
    execute: async (context, resultBuilder) => {
      const id = await context.getRecordId();
      const record = await context.getRecord(['status', 'amount', 'currency']);

      if (RESOLVED.includes(record.status as string)) {
        return resultBuilder.error(`Chargeback already resolved (${record.status}).`);
      }

      await context.collection.update(byId(id), {
        status: 'WON',
        decision_at: now(),
        provisional_credit_issued: true,
        resolution_notes: context.formValues['Resolution Notes'] ?? null,
        analyst_email: context.caller.email,
        updated_at: now(),
      });

      return resultBuilder.success(
        `Chargeback won. Final credit of ${record.amount} ${record.currency} posted.`,
      );
    },
  });

  collection.addAction('Mark Lost', {
    scope: 'Single',
    form: [
      {
        label: 'Resolution Notes',
        type: 'String',
        isRequired: true,
        description: 'Why did we lose? Network ruling, evidence rejected, etc.',
      },
    ],
    execute: async (context, resultBuilder) => {
      const id = await context.getRecordId();
      const record = await context.getRecord(['status']);

      if (RESOLVED.includes(record.status as string)) {
        return resultBuilder.error(`Chargeback already resolved (${record.status}).`);
      }

      await context.collection.update(byId(id), {
        status: 'LOST',
        decision_at: now(),
        provisional_credit_issued: false,
        resolution_notes: context.formValues['Resolution Notes'],
        analyst_email: context.caller.email,
        updated_at: now(),
      });

      return resultBuilder.success('Chargeback marked as lost. No credit issued.');
    },
  });

  collection.addAction('Dismiss Dispute', {
    scope: 'Single',
    form: [
      {
        label: 'Dismissal Reason',
        type: 'Enum',
        enumValues: [
          'BEYOND_FILING_WINDOW',
          'INSUFFICIENT_EVIDENCE',
          'CARDHOLDER_WITHDREW',
          'NOT_A_VALID_DISPUTE',
          'OTHER',
        ],
        isRequired: true,
      },
      { label: 'Notes', type: 'String', isRequired: true, description: 'Internal notes.' },
    ],
    execute: async (context, resultBuilder) => {
      const id = await context.getRecordId();
      const record = await context.getRecord(['status']);

      if (RESOLVED.includes(record.status as string)) {
        return resultBuilder.error(`Chargeback is already resolved (${record.status}).`);
      }

      await context.collection.update(byId(id), {
        status: 'DISMISSED',
        decision_at: now(),
        provisional_credit_issued: false,
        resolution_notes: `[${context.formValues['Dismissal Reason']}] ${context.formValues.Notes}`,
        analyst_email: context.caller.email,
        updated_at: now(),
      });

      return resultBuilder.success(
        `Dispute dismissed (${context.formValues['Dismissal Reason']}). No refund issued.`,
      );
    },
  });
}
