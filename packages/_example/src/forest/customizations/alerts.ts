import type { AlertsCustomizer } from '../typings';

import { randomUUID } from 'crypto';

import newReference from '../references';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const INVESTIGATION_DEADLINE_IN_DAYS = 30;
const STALE_AFTER_DAYS = 7;
const PENDING_STATUSES = ['OPEN', 'IN_REVIEW', 'SECOND_LOOK'];
const PRIORITY_BY_SEVERITY = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'URGENT' };

export default (collection: AlertsCustomizer) =>
  collection
    .removeField('rule_id', 'login_event_id')
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addManyToOneRelation('investigation', 'investigations', { foreignKey: 'investigation_id' })

    .addField('days_open', {
      columnType: 'Number',
      dependencies: ['triggered_at', 'resolved_at'],
      getValues: records =>
        records.map(record => {
          const end = record.resolved_at ? new Date(record.resolved_at).getTime() : Date.now();

          return Math.trunc((end - new Date(record.triggered_at).getTime()) / DAY_IN_MS);
        }),
    })
    .emulateFieldSorting('days_open')
    .emulateFieldOperator('days_open', 'GreaterThan')
    .addSegment('Stale alerts', {
      aggregator: 'And',
      conditions: [
        { field: 'status', operator: 'In', value: PENDING_STATUSES },
        { field: 'days_open', operator: 'GreaterThan', value: STALE_AFTER_DAYS },
      ],
    })

    .addAction('Escalate alert', {
      scope: 'Single',
      form: [{ label: 'Reason', type: 'String', widget: 'TextArea', isRequired: true }],
      execute: async (context, resultBuilder) => {
        const alert = await context.getRecord(['status', 'customer_id', 'category', 'severity']);

        if (!PENDING_STATUSES.includes(alert.status)) {
          return resultBuilder.error(
            `Only a pending alert can be escalated, this one is ${alert.status}`,
          );
        }

        const now = new Date();
        const investigationId = randomUUID();
        const reference = newReference('INV');

        await context.dataSource.getCollection('investigations').create([
          {
            id: investigationId,
            reference,
            customer_id: alert.customer_id,
            type: alert.category,
            origin: 'ALERTS',
            status: 'OPEN',
            priority: PRIORITY_BY_SEVERITY[alert.severity] ?? 'MEDIUM',
            summary: context.formValues.Reason,
            assigned_to: context.caller.email,
            opened_at: now.toISOString(),
            due_at: new Date(
              now.getTime() + INVESTIGATION_DEADLINE_IN_DAYS * DAY_IN_MS,
            ).toISOString(),
          },
        ]);

        await context.collection.update(context.filter, {
          status: 'ESCALATED',
          escalated_at: now.toISOString(),
          investigation_id: investigationId,
        });

        return resultBuilder.success(`Alert escalated to investigation ${reference}`);
      },
    });
