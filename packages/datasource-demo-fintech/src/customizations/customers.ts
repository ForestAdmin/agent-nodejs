import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';

// customers is the hub: everything links back to a customer.
export default function customizeCustomers(collection: CollectionCustomizer): void {
  collection
    .addOneToManyRelation('cards', 'cards', { originKey: 'customer_id' })
    .addOneToManyRelation('amlAlerts', 'aml_alerts', { originKey: 'customer_id' })
    .addOneToManyRelation('kycCases', 'kyc_cases', { originKey: 'customer_id' })
    .addOneToManyRelation('kycDocuments', 'kyc_documents', { originKey: 'customer_id' })
    .addOneToManyRelation('chargebacks', 'chargebacks', { originKey: 'customer_id' })
    .addOneToManyRelation('refundRequests', 'refund_requests', { originKey: 'customer_id' })
    .addOneToManyRelation('sarReports', 'sar_reports', { originKey: 'customer_id' });
}
