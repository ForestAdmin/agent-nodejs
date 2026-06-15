import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';

import { byId, now } from './utils';

export default function customizeSarReports(collection: CollectionCustomizer): void {
  // Relationships
  collection
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addManyToOneRelation('alert', 'aml_alerts', { foreignKey: 'alert_id' });

  // File the SAR with the financial intelligence unit and escalate the source alert.
  collection.addAction('File SAR', {
    scope: 'Single',
    form: [],
    execute: async (context, resultBuilder) => {
      const sarId = await context.getRecordId();
      const sar = await context.getRecord(['reference', 'alert_id']);

      await context.collection.update(byId(sarId), { status: 'FILED', filed_at: now() });

      if (sar.alert_id) {
        await context.dataSource
          .getCollection('aml_alerts')
          .update(
            { conditionTree: { field: 'id', operator: 'Equal', value: sar.alert_id } },
            { status: 'SAR_FILED', sar_reference: sar.reference, resolved_at: now() },
          );
      }

      return resultBuilder.success(`SAR ${sar.reference} filed. Source alert escalated.`);
    },
  });
}
