import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';

import { byId, now } from './utils';

export default function customizeAmlAlerts(collection: CollectionCustomizer): void {
  // Relationships
  collection
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addOneToManyRelation('sarReports', 'sar_reports', { originKey: 'alert_id' });

  collection.addAction('Clear Alert (False Positive)', {
    scope: 'Single',
    form: [
      {
        label: 'Resolution Notes',
        type: 'String',
        isRequired: true,
        description: 'Explain why this alert is considered a false positive.',
      },
    ],
    execute: async (context, resultBuilder) => {
      const id = await context.getRecordId();

      await context.collection.update(byId(id), {
        status: 'CLEARED',
        resolution_notes: context.formValues['Resolution Notes'],
        resolved_at: now(),
      });

      return resultBuilder.success('Alert cleared as false positive. No SAR filed.');
    },
  });

  collection.addAction('Create SAR', {
    scope: 'Single',
    form: [
      {
        label: 'Narrative',
        type: 'String',
        isRequired: true,
        description: 'Describe the suspicious activity (Part V of the SAR).',
      },
      { label: 'Activity Start Date', type: 'Dateonly', isRequired: true },
      { label: 'Activity End Date', type: 'Dateonly', isRequired: true },
      { label: 'Total Amount (€)', type: 'Number', isRequired: true },
      { label: 'Transaction Count', type: 'Number', isRequired: false },
    ],
    execute: async (context, resultBuilder) => {
      const alertId = await context.getRecordId();
      const alert = await context.getRecord(['alert_type', 'customer_id']);

      const sarReports = context.dataSource.getCollection('sar_reports');
      const existing = await sarReports.list(
        { conditionTree: { field: 'alert_id', operator: 'Equal', value: alertId } },
        ['reference'],
      );

      if (existing.length) {
        return resultBuilder.error(
          `A SAR already exists for this alert (${existing[0].reference}). File it from the SAR Reports collection.`,
        );
      }

      const all = await sarReports.list({}, ['id']);
      const nextId = all.reduce((max, r) => Math.max(max, Number(r.id)), 0) + 1;
      const reference = `SAR-${new Date().getUTCFullYear()}-${String(nextId).padStart(5, '0')}`;

      await sarReports.create([
        {
          id: nextId,
          alert_id: alertId,
          customer_id: alert.customer_id,
          reference,
          status: 'DRAFT',
          activity_type: alert.alert_type,
          activity_start_date: context.formValues['Activity Start Date'],
          activity_end_date: context.formValues['Activity End Date'],
          total_amount: context.formValues['Total Amount (€)'],
          transaction_count: context.formValues['Transaction Count'] ?? null,
          narrative: context.formValues.Narrative,
          created_at: now(),
        },
      ]);

      await context.collection.update(byId(alertId), { status: 'ESCALATED' });

      return resultBuilder.success(
        `SAR draft created (${reference}). Alert escalated for MLRO review.`,
      );
    },
  });

  collection.addAction('Escalate to Compliance', {
    scope: 'Single',
    form: [
      {
        label: 'Escalation Reason',
        type: 'String',
        isRequired: true,
        description: 'Explain why this alert requires senior compliance review (MLRO).',
      },
    ],
    execute: async (context, resultBuilder) => {
      const id = await context.getRecordId();

      await context.collection.update(byId(id), {
        status: 'ESCALATED',
        severity: 'HIGH',
        resolution_notes: context.formValues['Escalation Reason'],
      });

      return resultBuilder.success(
        'Alert escalated to compliance (MLRO). Severity upgraded to HIGH.',
      );
    },
  });

  collection.addAction('File SAR', {
    scope: 'Single',
    form: [
      {
        label: 'SAR Reference',
        type: 'String',
        isRequired: true,
        description: 'Internal SAR case number (e.g. SAR-2026-00042).',
      },
    ],
    execute: async (context, resultBuilder) => {
      const id = await context.getRecordId();

      await context.collection.update(byId(id), {
        status: 'SAR_FILED',
        sar_reference: context.formValues['SAR Reference'],
        resolved_at: now(),
      });

      return resultBuilder.success(`SAR filed (ref: ${context.formValues['SAR Reference']}).`);
    },
  });

  collection.addAction('Request Enhanced Due Diligence', {
    scope: 'Single',
    form: [
      {
        label: 'EDD Reason',
        type: 'String',
        isRequired: true,
        description: 'Explain why enhanced due diligence is required for this customer.',
      },
    ],
    execute: async (context, resultBuilder) => {
      const id = await context.getRecordId();

      // Alert stays OPEN — investigation is ongoing, EDD requested.
      await context.collection.update(byId(id), {
        resolution_notes: `EDD requested: ${context.formValues['EDD Reason']}`,
      });

      return resultBuilder.success(
        'Enhanced Due Diligence requested. Customer flagged for monitoring.',
      );
    },
  });
}
